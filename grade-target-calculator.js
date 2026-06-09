(() => {
  'use strict';

  const STORAGE_KEY = 'dtu_grade_target_calculator_v1';
  const GRADE_SCALE = [
    { letter: 'A+', min: 9.5, tone: 'danger' },
    { letter: 'A', min: 8.5, tone: 'danger' },
    { letter: 'A-', min: 8.0, tone: 'danger' },
    { letter: 'B+', min: 7.5, tone: 'danger' },
    { letter: 'B', min: 7.0, tone: 'success' },
    { letter: 'B-', min: 6.5, tone: 'success' },
    { letter: 'C+', min: 6.0, tone: 'success' },
    { letter: 'C', min: 5.5, tone: 'success' },
    { letter: 'C-', min: 4.5, tone: 'success' },
    { letter: 'D', min: 4.0, tone: 'success' }
  ];

  const uid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const toNumber = (value) => {
    if (value === '' || value === null || typeof value === 'undefined') return null;
    const number = Number(String(value).replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  };
  const scoreValue = (value) => {
    const number = toNumber(value);
    return number === null ? null : clamp(number, 0, 10);
  };
  const weightValue = (value) => {
    const number = toNumber(value);
    return number === null ? 0 : clamp(number, 0, 100);
  };
  const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  };
  const format = (value, digits = 2) => {
    if (!Number.isFinite(value)) return '—';
    return round(value, digits).toFixed(digits).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };
  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function newCourse(index = 1) {
    return {
      id: uid(),
      name: `Môn ${index}`,
      overallPercent: '',
      mode: 'quick',
      quick: {
        componentScore: '',
        componentWeight: 45,
        finalScore: '',
        finalWeight: 55
      },
      advanced: {
        components: [
          { id: uid(), name: 'Điểm thành phần', score: '', weight: 45 }
        ],
        finalScore: '',
        finalWeight: 55
      },
      weightsOpen: false,
      targetOpen: true
    };
  }

  function normalizeCourse(raw, index) {
    const fallback = newCourse(index + 1);
    const course = raw && typeof raw === 'object' ? raw : {};
    return {
      id: course.id || fallback.id,
      name: typeof course.name === 'string' ? course.name : fallback.name,
      overallPercent: course.overallPercent ?? '',
      mode: course.mode === 'advanced' ? 'advanced' : 'quick',
      quick: {
        componentScore: course.quick?.componentScore ?? '',
        componentWeight: weightValue(course.quick?.componentWeight ?? 45),
        finalScore: course.quick?.finalScore ?? '',
        finalWeight: weightValue(course.quick?.finalWeight ?? 55)
      },
      advanced: {
        components: Array.isArray(course.advanced?.components) && course.advanced.components.length
          ? course.advanced.components.map((item, itemIndex) => ({
              id: item?.id || uid(),
              name: typeof item?.name === 'string' ? item.name : `Thành phần ${itemIndex + 1}`,
              score: item?.score ?? '',
              weight: weightValue(item?.weight ?? 0)
            }))
          : fallback.advanced.components,
        finalScore: course.advanced?.finalScore ?? '',
        finalWeight: weightValue(course.advanced?.finalWeight ?? 55)
      },
      weightsOpen: Boolean(course.weightsOpen),
      targetOpen: course.targetOpen !== false
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.courses) && parsed.courses.length) {
        return { courses: parsed.courses.map(normalizeCourse) };
      }
    } catch (error) {
      console.warn('Không đọc được dữ liệu bộ tính điểm:', error);
    }
    return { courses: [newCourse(1)] };
  }

  function gradeFor(score) {
    if (!Number.isFinite(score)) return { letter: '—', label: 'Chưa đủ dữ liệu', className: 'neutral' };
    const found = GRADE_SCALE.find((grade) => score >= grade.min);
    if (found) return { letter: found.letter, label: score >= 4 ? 'Đạt' : 'Chưa đạt', className: score >= 4 ? 'pass' : 'fail' };
    return { letter: 'F', label: 'Chưa đạt', className: 'fail' };
  }

  class DtuGradeTargetCalculator extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = loadState();
      this.open = false;
      this.activeCourseId = this.state.courses[0]?.id || null;
      this.render();
    }

    connectedCallback() {
      this.shadowRoot.addEventListener('click', (event) => this.onClick(event));
      this.shadowRoot.addEventListener('input', (event) => this.onInput(event));
      this.shadowRoot.addEventListener('change', (event) => this.onChange(event));
      document.addEventListener('keydown', this.onKeyDown);
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this.onKeyDown);
    }

    onKeyDown = (event) => {
      if (event.key === 'Escape' && this.open) {
        this.open = false;
        this.render();
      }
    };

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (error) {
        console.warn('Không lưu được dữ liệu bộ tính điểm:', error);
      }
    }

    getCourse(courseId) {
      return this.state.courses.find((course) => course.id === courseId);
    }

    activeCourse() {
      return this.getCourse(this.activeCourseId) || this.state.courses[0];
    }

    onClick(event) {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const courseId = target.dataset.courseId;
      const rowId = target.dataset.rowId;

      if (action === 'open') {
        this.open = true;
        this.render();
        requestAnimationFrame(() => this.shadowRoot.querySelector('.modal')?.focus());
        return;
      }
      if (action === 'close') {
        this.open = false;
        this.render();
        return;
      }
      if (action === 'backdrop' && event.target === target) {
        this.open = false;
        this.render();
        return;
      }
      if (action === 'add-course') {
        const course = newCourse(this.state.courses.length + 1);
        this.state.courses.push(course);
        this.activeCourseId = course.id;
        this.save();
        this.render();
        return;
      }
      if (action === 'select-course') {
        this.activeCourseId = courseId;
        this.render();
        return;
      }
      if (action === 'remove-course') {
        if (this.state.courses.length === 1) {
          const current = this.getCourse(courseId);
          const replacement = newCourse(1);
          replacement.id = current.id;
          this.state.courses = [replacement];
          this.activeCourseId = replacement.id;
        } else {
          const index = this.state.courses.findIndex((course) => course.id === courseId);
          this.state.courses = this.state.courses.filter((course) => course.id !== courseId);
          if (this.activeCourseId === courseId) {
            this.activeCourseId = this.state.courses[Math.max(0, index - 1)]?.id || this.state.courses[0]?.id;
          }
        }
        this.save();
        this.render();
        return;
      }
      if (action === 'set-mode') {
        const course = this.getCourse(courseId);
        if (!course) return;
        course.mode = target.dataset.mode === 'advanced' ? 'advanced' : 'quick';
        this.save();
        this.render();
        return;
      }
      if (action === 'toggle-weights') {
        const course = this.getCourse(courseId);
        if (!course) return;
        course.weightsOpen = !course.weightsOpen;
        this.save();
        this.render();
        return;
      }
      if (action === 'preset-weight') {
        const course = this.getCourse(courseId);
        if (!course) return;
        const componentWeight = weightValue(target.dataset.componentWeight);
        course.quick.componentWeight = componentWeight;
        course.quick.finalWeight = 100 - componentWeight;
        this.save();
        this.render();
        return;
      }
      if (action === 'swap-weight') {
        const course = this.getCourse(courseId);
        if (!course) return;
        const currentComponent = course.quick.componentWeight;
        course.quick.componentWeight = course.quick.finalWeight;
        course.quick.finalWeight = currentComponent;
        this.save();
        this.render();
        return;
      }
      if (action === 'toggle-target') {
        const course = this.getCourse(courseId);
        if (!course) return;
        course.targetOpen = !course.targetOpen;
        this.save();
        this.render();
        return;
      }
      if (action === 'add-component') {
        const course = this.getCourse(courseId);
        if (!course) return;
        course.advanced.components.push({
          id: uid(),
          name: `Thành phần ${course.advanced.components.length + 1}`,
          score: '',
          weight: 0
        });
        this.save();
        this.render();
        return;
      }
      if (action === 'remove-component') {
        const course = this.getCourse(courseId);
        if (!course) return;
        if (course.advanced.components.length === 1) {
          course.advanced.components[0] = { id: uid(), name: 'Điểm thành phần', score: '', weight: 45 };
        } else {
          course.advanced.components = course.advanced.components.filter((row) => row.id !== rowId);
        }
        this.save();
        this.render();
        return;
      }
      if (action === 'reset-all') {
        if (!window.confirm('Xóa toàn bộ dữ liệu tính điểm đã lưu?')) return;
        this.state = { courses: [newCourse(1)] };
        this.activeCourseId = this.state.courses[0].id;
        this.save();
        this.render();
      }
    }

    onInput(event) {
      const field = event.target.dataset.field;
      const courseId = event.target.dataset.courseId;
      if (!field || !courseId) return;
      const course = this.getCourse(courseId);
      if (!course) return;
      const rowId = event.target.dataset.rowId;
      const value = event.target.value;

      if (field === 'course-name') {
        course.name = value;
        this.save();
        this.updateLive(courseId);
        return;
      }

      if (field === 'overall-percent') {
        course.overallPercent = value;
        this.save();
        this.updateLive(courseId);
        return;
      }

      if (field === 'quick-component-score') {
        course.quick.componentScore = value;
        const earnedInput = this.shadowRoot.querySelector(`[data-course-id="${courseId}"][data-field="quick-component-earned"]`);
        const componentScore = scoreValue(value);
        if (earnedInput) earnedInput.value = componentScore === null ? '' : format(componentScore * weightValue(course.quick.componentWeight) / 10, 2);
      }
      if (field === 'quick-component-earned') {
        const componentWeight = weightValue(course.quick.componentWeight);
        const rawEarned = toNumber(value);
        const earned = rawEarned === null ? null : clamp(rawEarned, 0, componentWeight);
        course.quick.componentScore = earned === null || componentWeight <= 0
          ? ''
          : format(earned / componentWeight * 10, 4);
        const scoreInput = this.shadowRoot.querySelector(`[data-course-id="${courseId}"][data-field="quick-component-score"]`);
        if (scoreInput) scoreInput.value = course.quick.componentScore === '' ? '' : format(scoreValue(course.quick.componentScore), 2);
      }
      if (field === 'quick-final-score') course.quick.finalScore = value;
      if (field === 'quick-component-weight') {
        const componentWeight = weightValue(value);
        course.quick.componentWeight = componentWeight;
        course.quick.finalWeight = 100 - componentWeight;
        event.target.value = componentWeight;
        const finalInput = this.shadowRoot.querySelector(`[data-course-id="${courseId}"][data-field="quick-final-weight"]`);
        if (finalInput) finalInput.value = course.quick.finalWeight;
        const earnedInput = this.shadowRoot.querySelector(`[data-course-id="${courseId}"][data-field="quick-component-earned"]`);
        const earnedMax = this.shadowRoot.querySelector(`[data-course-id="${courseId}"][data-earned-max]`);
        const componentScore = scoreValue(course.quick.componentScore);
        if (earnedInput) {
          earnedInput.max = componentWeight;
          earnedInput.value = componentScore === null ? '' : format(componentScore * componentWeight / 10, 2);
        }
        if (earnedMax) earnedMax.textContent = `/ ${format(componentWeight, 0)}%`;
      }
      if (field === 'quick-final-weight') {
        const finalWeight = weightValue(value);
        course.quick.finalWeight = finalWeight;
        course.quick.componentWeight = 100 - finalWeight;
        event.target.value = finalWeight;
        const componentInput = this.shadowRoot.querySelector(`[data-course-id="${courseId}"][data-field="quick-component-weight"]`);
        if (componentInput) componentInput.value = course.quick.componentWeight;
        const earnedInput = this.shadowRoot.querySelector(`[data-course-id="${courseId}"][data-field="quick-component-earned"]`);
        const earnedMax = this.shadowRoot.querySelector(`[data-course-id="${courseId}"][data-earned-max]`);
        const componentScore = scoreValue(course.quick.componentScore);
        if (earnedInput) {
          earnedInput.max = course.quick.componentWeight;
          earnedInput.value = componentScore === null ? '' : format(componentScore * course.quick.componentWeight / 10, 2);
        }
        if (earnedMax) earnedMax.textContent = `/ ${format(course.quick.componentWeight, 0)}%`;
      }
      if (field === 'advanced-final-score') course.advanced.finalScore = value;
      if (field === 'advanced-final-weight') course.advanced.finalWeight = weightValue(value);
      if (field === 'component-name') {
        const row = course.advanced.components.find((item) => item.id === rowId);
        if (row) row.name = value;
      }
      if (field === 'component-score') {
        const row = course.advanced.components.find((item) => item.id === rowId);
        if (row) row.score = value;
      }
      if (field === 'component-weight') {
        const row = course.advanced.components.find((item) => item.id === rowId);
        if (row) row.weight = weightValue(value);
      }

      this.save();
      this.updateLive(courseId);
    }

    onChange(event) {
      const scoreField = event.target.matches('[data-score-input="true"]');
      const earnedField = event.target.matches('[data-earned-input="true"]');
      const overallField = event.target.matches('[data-overall-input="true"]');
      if (!scoreField && !earnedField && !overallField) return;
      if (scoreField) {
        const number = scoreValue(event.target.value);
        if (number !== null) event.target.value = format(number, 2);
      }
      if (earnedField) {
        const course = this.getCourse(event.target.dataset.courseId);
        const max = weightValue(course?.quick?.componentWeight);
        const number = toNumber(event.target.value);
        if (number !== null) event.target.value = format(clamp(number, 0, max), 2);
      }
      if (overallField) {
        const number = toNumber(event.target.value);
        if (number !== null) event.target.value = format(clamp(number, 0, 100), 2);
      }
      this.onInput(event);
    }

    calculate(course) {
      const rawOverallPercent = toNumber(course.overallPercent);
      const overallPercent = rawOverallPercent === null ? null : clamp(rawOverallPercent, 0, 100);
      const manualTotal = overallPercent === null ? null : overallPercent / 10;

      if (course.mode === 'quick') {
        const componentScore = scoreValue(course.quick.componentScore);
        const finalScore = scoreValue(course.quick.finalScore);
        const componentWeight = weightValue(course.quick.componentWeight);
        const finalWeight = weightValue(course.quick.finalWeight);
        const weightTotal = componentWeight + finalWeight;
        const componentContribution = componentScore === null ? 0 : componentScore * componentWeight / 100;
        const finalContribution = finalScore === null ? 0 : finalScore * finalWeight / 100;
        const complete = componentScore !== null && finalScore !== null && Math.abs(weightTotal - 100) < 0.001;
        return {
          componentContribution,
          finalContribution,
          total: complete ? componentContribution + finalContribution : null,
          current: componentContribution + finalContribution,
          componentWeight,
          finalWeight,
          weightTotal,
          finalScore,
          complete,
          missingComponent: componentScore === null,
          componentEarnedPercent: componentContribution * 10,
          overallPercent,
          manualTotal
        };
      }

      const components = course.advanced.components;
      const finalWeight = weightValue(course.advanced.finalWeight);
      const finalScore = scoreValue(course.advanced.finalScore);
      let componentContribution = 0;
      let componentWeight = 0;
      let missingComponent = false;
      for (const row of components) {
        const score = scoreValue(row.score);
        const weight = weightValue(row.weight);
        componentWeight += weight;
        if (score === null && weight > 0) missingComponent = true;
        if (score !== null) componentContribution += score * weight / 100;
      }
      const finalContribution = finalScore === null ? 0 : finalScore * finalWeight / 100;
      const weightTotal = componentWeight + finalWeight;
      const complete = !missingComponent && finalScore !== null && Math.abs(weightTotal - 100) < 0.001;
      return {
        componentContribution,
        finalContribution,
        total: complete ? componentContribution + finalContribution : null,
        current: componentContribution + finalContribution,
        componentWeight,
        finalWeight,
        weightTotal,
        finalScore,
        complete,
        missingComponent,
        componentEarnedPercent: componentContribution * 10,
        overallPercent,
        manualTotal
      };
    }

    requiredFinal(calc, threshold) {
      if (calc.missingComponent || calc.finalWeight <= 0) return { type: 'missing', text: 'Nhập điểm TP' };
      const required = (threshold - calc.componentContribution) / (calc.finalWeight / 100);
      if (required <= 0) return { type: 'done', text: 'Đã đạt' };
      if (required > 10) return { type: 'impossible', text: 'Không thể' };
      return { type: 'score', text: `≥ ${format(required, 2)}`, value: required };
    }

    updateLive(courseId) {
      const course = this.getCourse(courseId);
      if (!course) return;
      const calc = this.calculate(course);
      const live = this.shadowRoot.querySelector(`[data-live-course="${courseId}"]`);
      const target = this.shadowRoot.querySelector(`[data-target-course="${courseId}"]`);
      const tabName = this.shadowRoot.querySelector(`[data-tab-name="${courseId}"]`);
      const overallSummary = this.shadowRoot.querySelector(`[data-overall-summary="${courseId}"]`);
      if (live) live.innerHTML = this.resultHTML(course, calc);
      if (target) target.innerHTML = this.targetHTML(course, calc);
      if (tabName) tabName.textContent = course.name.trim() || 'Chưa đặt tên';
      if (overallSummary) overallSummary.innerHTML = this.overallSummaryHTML(calc);
    }

    overallSummaryHTML(calc) {
      const score = calc.manualTotal;
      const grade = gradeFor(score);
      return score === null
        ? '<span class="overall-empty">Nhập 0–100%</span>'
        : `<span><b>${format(score, 2)}/10</b><em>Điểm chữ ${grade.letter}</em></span>`;
    }

    resultHTML(course, calc) {
      const score = calc.manualTotal ?? calc.total;
      const grade = gradeFor(score);
      const weightOkay = Math.abs(calc.weightTotal - 100) < 0.001;
      let helper = '';
      if (calc.manualTotal !== null) helper = `<span class="${grade.className === 'pass' ? 'success-text' : 'danger-text'}">Quy đổi trực tiếp từ ${format(calc.overallPercent, 2)}% tổng toàn môn • ${grade.label}</span>`;
      else if (!weightOkay) helper = `<span class="warning">Tổng trọng số đang là ${format(calc.weightTotal)}%, cần bằng 100%.</span>`;
      else if (calc.missingComponent) helper = '<span class="muted">Nhập đủ điểm thành phần để tính chính xác.</span>';
      else if (calc.finalScore === null) helper = `<span class="muted">Hiện đã có ${format(calc.componentContribution)} điểm trước cuối kỳ.</span>`;
      else helper = `<span class="${grade.className === 'pass' ? 'success-text' : 'danger-text'}">${grade.label}</span>`;

      return `
        <div class="result-score">
          <span class="result-label">TỔNG ĐIỂM</span>
          <strong>${score === null ? format(calc.current) : format(score)}</strong>
          <span class="result-max">/ 10</span>
        </div>
        <div class="grade-badge ${grade.className}">
          <span>Điểm chữ</span>
          <strong>${grade.letter}</strong>
        </div>
        <div class="result-helper">${helper}</div>
      `;
    }

    targetHTML(course, calc) {
      return `
        <div class="target-header">
          <div>
            <span class="eyebrow">CẦN ĐẠT Ở CUỐI KỲ</span>
            <strong>Thành phần: ${calc.missingComponent ? '—' : format(calc.componentEarnedPercent, 2)}% / ${format(calc.componentWeight, 0)}% • Cuối kỳ: ${format(calc.finalWeight, 0)}%</strong>
          </div>
          <button type="button" class="icon-btn" data-action="toggle-target" data-course-id="${course.id}" aria-label="Thu gọn bảng cần đạt">
            ${course.targetOpen ? '−' : '+'}
          </button>
        </div>
        ${course.targetOpen ? `
          <div class="target-list">
            ${GRADE_SCALE.map((grade) => {
              const required = this.requiredFinal(calc, grade.min);
              const achieved = calc.total !== null && calc.total >= grade.min;
              return `
                <div class="target-row ${achieved ? 'achieved' : ''}">
                  <span>Điểm chữ <b>${grade.letter}</b></span>
                  <strong class="${required.type}">${required.text}</strong>
                </div>
              `;
            }).join('')}
          </div>
          <p class="target-note">Điểm hiển thị là mức tối thiểu cần đạt ở bài cuối kỳ để tổng kết chạm mốc điểm chữ tương ứng.</p>
        ` : ''}
      `;
    }

    overallPercentHTML(course) {
      const raw = toNumber(course.overallPercent);
      const percent = raw === null ? null : clamp(raw, 0, 100);
      const calc = this.calculate(course);
      return `
        <label class="overall-percent-card">
          <span class="overall-copy">
            <strong>Tổng % tất cả cột</strong>
            <small>Nhập tổng phần trăm toàn môn trên myDTU để biết điểm chữ ngay</small>
          </span>
          <span class="overall-input-wrap">
            <input data-overall-input="true" data-field="overall-percent" data-course-id="${course.id}" inputmode="decimal" type="number" min="0" max="100" step="0.01" placeholder="0 - 100" value="${percent === null ? '' : escapeHTML(format(percent, 2))}">
            <b>%</b>
          </span>
          <span class="overall-summary" data-overall-summary="${course.id}">${this.overallSummaryHTML(calc)}</span>
        </label>
      `;
    }

    quickHTML(course) {
      const quick = course.quick;
      return `
        <div class="two-fields">
          <label class="score-card component-card">
            <span class="field-title">Điểm thành phần</span>
            <span class="weight-pill">${format(quick.componentWeight, 0)}%</span>
            <input data-score-input="true" data-field="quick-component-score" data-course-id="${course.id}" inputmode="decimal" type="number" min="0" max="10" step="0.01" placeholder="0 - 10" value="${escapeHTML(quick.componentScore)}">
          </label>
          <label class="score-card final-card">
            <span class="field-title">Điểm cuối kỳ</span>
            <span class="weight-pill">${format(quick.finalWeight, 0)}%</span>
            <input data-score-input="true" data-field="quick-final-score" data-course-id="${course.id}" inputmode="decimal" type="number" min="0" max="10" step="0.01" placeholder="0 - 10" value="${escapeHTML(quick.finalScore)}">
          </label>
        </div>
        <label class="earned-percent-card">
          <span>
            <strong>Tổng % thành phần đã đạt</strong>
            <small>Nhập trực tiếp nếu myDTU đã hiện tổng %, ví dụ 36 / 45%</small>
          </span>
          <span class="earned-percent-input">
            <input data-earned-input="true" data-field="quick-component-earned" data-course-id="${course.id}" inputmode="decimal" type="number" min="0" max="${escapeHTML(quick.componentWeight)}" step="0.01" placeholder="0" value="${scoreValue(quick.componentScore) === null ? '' : format(scoreValue(quick.componentScore) * weightValue(quick.componentWeight) / 10, 2)}">
            <b>%</b>
            <em data-earned-max data-course-id="${course.id}">/ ${format(quick.componentWeight, 0)}%</em>
          </span>
        </label>
        <div class="weight-actions">
          <button type="button" class="small-btn" data-action="toggle-weights" data-course-id="${course.id}">⚙ Đổi % hai phần</button>
          <span>Tổng: ${format(weightValue(quick.componentWeight) + weightValue(quick.finalWeight), 0)}%</span>
        </div>
        ${course.weightsOpen ? `
          <div class="weight-panel">
            <div class="weight-inputs">
              <label>Thành phần (%)
                <input data-field="quick-component-weight" data-course-id="${course.id}" type="number" min="0" max="100" step="1" value="${escapeHTML(quick.componentWeight)}">
              </label>
              <button type="button" class="swap-btn" data-action="swap-weight" data-course-id="${course.id}" title="Đổi chỗ hai tỷ lệ">⇄</button>
              <label>Cuối kỳ (%)
                <input data-field="quick-final-weight" data-course-id="${course.id}" type="number" min="0" max="100" step="1" value="${escapeHTML(quick.finalWeight)}">
              </label>
            </div>
            <div class="presets">
              <button type="button" data-action="preset-weight" data-course-id="${course.id}" data-component-weight="45">45 / 55</button>
              <button type="button" data-action="preset-weight" data-course-id="${course.id}" data-component-weight="50">50 / 50</button>
              <button type="button" data-action="preset-weight" data-course-id="${course.id}" data-component-weight="40">40 / 60</button>
              <button type="button" data-action="preset-weight" data-course-id="${course.id}" data-component-weight="30">30 / 70</button>
            </div>
          </div>
        ` : ''}
      `;
    }

    advancedHTML(course) {
      const advanced = course.advanced;
      return `
        <div class="advanced-head">
          <span>Nhập từng điểm thành phần và trọng số</span>
          <button type="button" class="small-btn" data-action="add-component" data-course-id="${course.id}">＋ Thêm thành phần</button>
        </div>
        <div class="component-list">
          ${advanced.components.map((row, index) => `
            <div class="component-row">
              <span class="row-index">${index + 1}</span>
              <label class="row-name">
                <span>Tên thành phần</span>
                <input data-field="component-name" data-course-id="${course.id}" data-row-id="${row.id}" type="text" value="${escapeHTML(row.name)}" placeholder="Ví dụ: Giữa kỳ">
              </label>
              <label>
                <span>Điểm</span>
                <input data-score-input="true" data-field="component-score" data-course-id="${course.id}" data-row-id="${row.id}" inputmode="decimal" type="number" min="0" max="10" step="0.01" value="${escapeHTML(row.score)}" placeholder="0 - 10">
              </label>
              <label>
                <span>Trọng số</span>
                <div class="percent-input"><input data-field="component-weight" data-course-id="${course.id}" data-row-id="${row.id}" type="number" min="0" max="100" step="1" value="${escapeHTML(row.weight)}"><b>%</b></div>
              </label>
              <button type="button" class="remove-row" data-action="remove-component" data-course-id="${course.id}" data-row-id="${row.id}" title="Xóa thành phần">×</button>
            </div>
          `).join('')}
        </div>
        <div class="final-row">
          <div>
            <span class="final-icon">🏁</span>
            <div><strong>Điểm cuối kỳ</strong><small>Dùng để tính điểm cần đạt</small></div>
          </div>
          <label>
            <span>Điểm</span>
            <input data-score-input="true" data-field="advanced-final-score" data-course-id="${course.id}" inputmode="decimal" type="number" min="0" max="10" step="0.01" value="${escapeHTML(advanced.finalScore)}" placeholder="0 - 10">
          </label>
          <label>
            <span>Trọng số</span>
            <div class="percent-input"><input data-field="advanced-final-weight" data-course-id="${course.id}" type="number" min="0" max="100" step="1" value="${escapeHTML(advanced.finalWeight)}"><b>%</b></div>
          </label>
        </div>
      `;
    }

    courseHTML(course) {
      const calc = this.calculate(course);
      return `
        <section class="course-card">
          <div class="course-heading">
            <div class="course-name-wrap">
              <span class="course-number">${this.state.courses.findIndex((item) => item.id === course.id) + 1}</span>
              <input class="course-name" data-field="course-name" data-course-id="${course.id}" value="${escapeHTML(course.name)}" maxlength="80" aria-label="Tên môn học">
            </div>
            <button type="button" class="delete-course" data-action="remove-course" data-course-id="${course.id}" title="Xóa môn">🗑</button>
          </div>

          ${this.overallPercentHTML(course)}

          <div class="mode-tabs" role="tablist">
            <button type="button" class="${course.mode === 'quick' ? 'active' : ''}" data-action="set-mode" data-mode="quick" data-course-id="${course.id}">⚡ Tính nhanh</button>
            <button type="button" class="${course.mode === 'advanced' ? 'active' : ''}" data-action="set-mode" data-mode="advanced" data-course-id="${course.id}">🧩 Nhiều thành phần</button>
          </div>

          <div class="calculator-grid">
            <div class="entry-panel">
              ${course.mode === 'quick' ? this.quickHTML(course) : this.advancedHTML(course)}
            </div>
            <div class="result-panel" data-live-course="${course.id}">
              ${this.resultHTML(course, calc)}
            </div>
          </div>

          <div class="target-panel" data-target-course="${course.id}">
            ${this.targetHTML(course, calc)}
          </div>
        </section>
      `;
    }

    styles() {
      return `
        :host { all: initial; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #e5e7eb; }
        *, *::before, *::after { box-sizing: border-box; }
        button, input { font: inherit; }
        button { cursor: pointer; }
        .launcher {
          position: fixed; right: 18px; bottom: 92px; z-index: 2147483000;
          display: flex; align-items: center; gap: 9px; border: 1px solid rgba(129, 140, 248, .45);
          border-radius: 999px; padding: 11px 15px; color: #fff; font-weight: 800; font-size: 13px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed); box-shadow: 0 14px 36px rgba(79, 70, 229, .35);
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .launcher:hover { transform: translateY(-2px); box-shadow: 0 18px 42px rgba(79, 70, 229, .48); }
        .launcher .launch-icon { font-size: 18px; }
        .overlay { position: fixed; inset: 0; z-index: 2147483001; display: grid; place-items: center; padding: 18px; background: rgba(2, 6, 23, .82); backdrop-filter: blur(12px); }
        .modal { width: min(1180px, 100%); max-height: calc(100vh - 36px); overflow: hidden; display: flex; flex-direction: column; outline: none; border: 1px solid rgba(100, 116, 139, .45); border-radius: 24px; background: #07101f; box-shadow: 0 30px 90px rgba(0, 0, 0, .62); }
        .modal-header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border-bottom: 1px solid rgba(100, 116, 139, .25); background: linear-gradient(135deg, rgba(79,70,229,.22), rgba(15,23,42,.6)); }
        .modal-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .modal-title > span { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 14px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-size: 21px; box-shadow: 0 8px 24px rgba(79,70,229,.35); }
        .modal-title h2 { margin: 0; color: #f8fafc; font-size: 20px; line-height: 1.2; }
        .modal-title p { margin: 4px 0 0; color: #94a3b8; font-size: 12px; }
        .header-actions { display: flex; align-items: center; gap: 8px; }
        .header-actions button { border: 1px solid rgba(100,116,139,.35); border-radius: 11px; padding: 9px 12px; color: #cbd5e1; background: rgba(15,23,42,.7); font-weight: 700; font-size: 12px; }
        .header-actions button:hover { border-color: rgba(129,140,248,.55); color: #fff; }
        .header-actions .close { width: 38px; height: 38px; padding: 0; font-size: 22px; }
        .workspace { min-height: 0; flex: 1; display: grid; grid-template-columns: 235px minmax(0, 1fr); }
        .sidebar { min-height: 0; overflow-y: auto; padding: 14px; border-right: 1px solid rgba(100,116,139,.22); background: rgba(2,6,23,.48); }
        .sidebar-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; color: #94a3b8; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
        .add-course { width: 100%; border: 1px dashed rgba(129,140,248,.55); border-radius: 12px; padding: 10px; color: #c7d2fe; background: rgba(79,70,229,.09); font-weight: 800; }
        .add-course:hover { background: rgba(79,70,229,.18); }
        .course-tabs { display: grid; gap: 7px; margin-top: 10px; }
        .course-tab { display: flex; align-items: center; gap: 9px; width: 100%; min-width: 0; border: 1px solid transparent; border-radius: 12px; padding: 10px; color: #94a3b8; background: transparent; text-align: left; }
        .course-tab:hover { color: #e2e8f0; background: rgba(30,41,59,.6); }
        .course-tab.active { color: #fff; border-color: rgba(129,140,248,.42); background: linear-gradient(135deg, rgba(79,70,229,.24), rgba(124,58,237,.13)); }
        .tab-index { flex: 0 0 auto; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 8px; color: #c7d2fe; background: rgba(99,102,241,.22); font-size: 11px; font-weight: 900; }
        .course-tab span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 700; }
        .content { min-height: 0; overflow-y: auto; padding: 18px; }
        .course-card { border: 1px solid rgba(100,116,139,.25); border-radius: 19px; padding: 17px; background: linear-gradient(155deg, rgba(15,23,42,.92), rgba(9,16,31,.96)); box-shadow: inset 0 1px rgba(255,255,255,.025); }
        .course-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 13px; }
        .course-name-wrap { min-width: 0; flex: 1; display: flex; align-items: center; gap: 10px; }
        .course-number { flex: 0 0 auto; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; color: #c7d2fe; background: rgba(79,70,229,.22); font-weight: 900; }
        .course-name { width: min(420px, 100%); border: 0; border-bottom: 1px solid transparent; padding: 5px 2px; outline: none; color: #f8fafc; background: transparent; font-size: 18px; font-weight: 850; }
        .course-name:focus { border-color: #6366f1; }
        .delete-course { flex: 0 0 auto; width: 35px; height: 35px; border: 1px solid rgba(244,63,94,.25); border-radius: 10px; color: #fda4af; background: rgba(244,63,94,.08); }
        .delete-course:hover { background: rgba(244,63,94,.18); }
        .overall-percent-card { margin: 2px 0 13px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 12px; border: 1px solid rgba(251,191,36,.38); border-radius: 14px; padding: 12px 14px; background: linear-gradient(135deg, rgba(245,158,11,.12), rgba(79,70,229,.08)); box-shadow: inset 0 1px rgba(255,255,255,.025); }
        .overall-copy { display: grid; gap: 3px; min-width: 0; }
        .overall-copy strong { color: #fef3c7; font-size: 13px; }
        .overall-copy small { color: #94a3b8; font-size: 10px; }
        .overall-input-wrap { display: flex; align-items: center; gap: 6px; min-width: 155px; border: 1px solid rgba(251,191,36,.42); border-radius: 11px; padding: 8px 11px; background: rgba(2,6,23,.62); }
        .overall-input-wrap input { width: 105px; border: 0; outline: none; color: #fff; background: transparent; text-align: right; font-size: 20px; font-weight: 900; }
        .overall-input-wrap input::placeholder { color: #475569; font-size: 14px; }
        .overall-input-wrap b { color: #fbbf24; }
        .overall-summary { min-width: 112px; border-left: 1px solid rgba(100,116,139,.25); padding-left: 12px; }
        .overall-summary > span { display: grid; gap: 2px; }
        .overall-summary b { color: #fff; font-size: 16px; }
        .overall-summary em { color: #fbbf24; font-size: 10px; font-style: normal; font-weight: 800; white-space: nowrap; }
        .overall-summary .overall-empty { color: #64748b; font-size: 11px; }
        .mode-tabs { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid rgba(100,116,139,.25); border-radius: 12px; background: rgba(2,6,23,.55); }
        .mode-tabs button { border: 0; border-radius: 9px; padding: 8px 12px; color: #94a3b8; background: transparent; font-size: 12px; font-weight: 800; }
        .mode-tabs button.active { color: #fff; background: linear-gradient(135deg, #4338ca, #6d28d9); box-shadow: 0 7px 18px rgba(79,70,229,.25); }
        .calculator-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(240px, .65fr); gap: 14px; margin-top: 14px; }
        .entry-panel, .result-panel, .target-panel { border: 1px solid rgba(100,116,139,.22); border-radius: 15px; background: rgba(2,6,23,.45); }
        .entry-panel { padding: 14px; }
        .two-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .score-card { position: relative; display: grid; gap: 9px; border: 1px solid rgba(100,116,139,.26); border-radius: 14px; padding: 14px; background: rgba(15,23,42,.68); }
        .score-card:focus-within { border-color: rgba(99,102,241,.7); box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
        .field-title { color: #cbd5e1; font-size: 12px; font-weight: 800; }
        .weight-pill { position: absolute; top: 11px; right: 11px; border-radius: 999px; padding: 3px 7px; color: #a5b4fc; background: rgba(99,102,241,.16); font-size: 10px; font-weight: 900; }
        .score-card input { width: 100%; border: 0; outline: none; color: #fff; background: transparent; font-size: 30px; font-weight: 900; }
        .score-card input::placeholder { color: #334155; font-size: 19px; }
        .earned-percent-card { margin-top: 11px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid rgba(45,212,191,.24); border-radius: 12px; padding: 10px 12px; background: rgba(13,148,136,.07); }
        .earned-percent-card > span:first-child { display: grid; gap: 2px; min-width: 0; }
        .earned-percent-card strong { color: #ccfbf1; font-size: 12px; }
        .earned-percent-card small { color: #64748b; font-size: 10px; }
        .earned-percent-input { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; border: 1px solid rgba(45,212,191,.28); border-radius: 10px; padding: 7px 9px; background: rgba(2,6,23,.55); }
        .earned-percent-input input { width: 72px; border: 0; outline: none; color: #fff; background: transparent; text-align: right; font-weight: 900; }
        .earned-percent-input b { color: #5eead4; }
        .earned-percent-input em { color: #94a3b8; font-size: 11px; font-style: normal; white-space: nowrap; }
        .weight-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 11px; color: #64748b; font-size: 11px; }
        .small-btn { border: 1px solid rgba(129,140,248,.35); border-radius: 9px; padding: 7px 10px; color: #c7d2fe; background: rgba(79,70,229,.1); font-size: 11px; font-weight: 800; }
        .small-btn:hover { background: rgba(79,70,229,.2); }
        .weight-panel { margin-top: 11px; border: 1px solid rgba(100,116,139,.22); border-radius: 12px; padding: 12px; background: rgba(15,23,42,.72); }
        .weight-inputs { display: grid; grid-template-columns: 1fr 38px 1fr; align-items: end; gap: 8px; }
        .weight-inputs label, .component-row label, .final-row label { display: grid; gap: 5px; color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
        .weight-inputs input, .component-row input, .final-row input { width: 100%; min-width: 0; border: 1px solid rgba(100,116,139,.35); border-radius: 9px; padding: 9px 10px; outline: none; color: #f8fafc; background: #0b1220; font-size: 13px; font-weight: 700; }
        .weight-inputs input:focus, .component-row input:focus, .final-row input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
        .swap-btn { width: 38px; height: 38px; border: 1px solid rgba(100,116,139,.3); border-radius: 10px; color: #a5b4fc; background: rgba(30,41,59,.7); font-size: 18px; }
        .presets { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .presets button { border: 1px solid rgba(100,116,139,.28); border-radius: 999px; padding: 5px 9px; color: #94a3b8; background: rgba(2,6,23,.45); font-size: 10px; font-weight: 800; }
        .presets button:hover { color: #fff; border-color: #6366f1; }
        .result-panel { display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; align-items: center; gap: 11px; padding: 15px; background: linear-gradient(145deg, rgba(30,41,59,.65), rgba(15,23,42,.42)); }
        .result-score { min-width: 0; }
        .result-label { display: block; margin-bottom: 4px; color: #64748b; font-size: 10px; font-weight: 900; letter-spacing: .1em; }
        .result-score strong { color: #f8fafc; font-size: 38px; line-height: 1; }
        .result-max { color: #64748b; font-size: 13px; font-weight: 700; }
        .grade-badge { display: grid; justify-items: center; min-width: 86px; border: 1px solid rgba(100,116,139,.3); border-radius: 14px; padding: 10px; background: rgba(2,6,23,.52); }
        .grade-badge span { color: #64748b; font-size: 9px; font-weight: 900; text-transform: uppercase; }
        .grade-badge strong { margin-top: 2px; color: #cbd5e1; font-size: 27px; }
        .grade-badge.pass { border-color: rgba(16,185,129,.4); background: rgba(16,185,129,.1); }
        .grade-badge.pass strong { color: #6ee7b7; }
        .grade-badge.fail { border-color: rgba(244,63,94,.4); background: rgba(244,63,94,.09); }
        .grade-badge.fail strong { color: #fda4af; }
        .result-helper { grid-column: 1 / -1; border-top: 1px solid rgba(100,116,139,.18); padding-top: 10px; font-size: 11px; }
        .muted { color: #94a3b8; } .warning { color: #fbbf24; } .success-text { color: #6ee7b7; font-weight: 800; } .danger-text { color: #fda4af; font-weight: 800; }
        .target-panel { margin-top: 14px; overflow: hidden; }
        .target-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 15px; background: linear-gradient(90deg, rgba(16,185,129,.08), rgba(15,23,42,.35)); }
        .target-header > div { display: grid; gap: 3px; }
        .eyebrow { color: #6ee7b7; font-size: 10px; font-weight: 900; letter-spacing: .09em; }
        .target-header strong { color: #cbd5e1; font-size: 12px; }
        .icon-btn { width: 30px; height: 30px; border: 1px solid rgba(100,116,139,.3); border-radius: 9px; color: #cbd5e1; background: rgba(2,6,23,.42); font-size: 18px; }
        .target-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 22px; padding: 5px 15px 11px; }
        .target-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px dashed rgba(100,116,139,.18); padding: 8px 1px; color: #cbd5e1; font-size: 11px; }
        .target-row b { color: #f8fafc; }
        .target-row strong { font-size: 12px; }
        .target-row strong.score { color: #86efac; } .target-row strong.done { color: #6ee7b7; } .target-row strong.impossible { color: #fb7185; } .target-row strong.missing { color: #94a3b8; }
        .target-row.achieved { opacity: .68; }
        .target-note { margin: 0; padding: 0 15px 13px; color: #64748b; font-size: 10px; line-height: 1.5; }
        .advanced-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; color: #94a3b8; font-size: 11px; }
        .component-list { display: grid; gap: 8px; }
        .component-row { display: grid; grid-template-columns: 25px minmax(130px, 1.5fr) minmax(90px, .7fr) minmax(95px, .75fr) 31px; align-items: end; gap: 7px; border: 1px solid rgba(100,116,139,.19); border-radius: 12px; padding: 9px; background: rgba(15,23,42,.5); }
        .row-index { align-self: center; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 8px; color: #a5b4fc; background: rgba(99,102,241,.14); font-size: 10px; font-weight: 900; }
        .percent-input { position: relative; }
        .percent-input input { padding-right: 27px; }
        .percent-input b { position: absolute; top: 50%; right: 9px; transform: translateY(-50%); color: #64748b; font-size: 11px; }
        .remove-row { width: 31px; height: 38px; border: 1px solid rgba(244,63,94,.22); border-radius: 9px; color: #fda4af; background: rgba(244,63,94,.06); font-size: 18px; }
        .final-row { display: grid; grid-template-columns: minmax(150px, 1.5fr) minmax(90px, .7fr) minmax(95px, .75fr) 38px; align-items: end; gap: 7px; margin-top: 9px; border: 1px solid rgba(16,185,129,.27); border-radius: 12px; padding: 10px; background: rgba(16,185,129,.055); }
        .final-row > div:first-child { align-self: center; display: flex; align-items: center; gap: 9px; }
        .final-icon { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 10px; background: rgba(16,185,129,.14); }
        .final-row strong { display: block; color: #d1fae5; font-size: 12px; }
        .final-row small { display: block; margin-top: 2px; color: #64748b; font-size: 9px; }
        .final-row::after { content: ''; width: 31px; }
        @media (max-width: 820px) {
          .workspace { grid-template-columns: 1fr; }
          .sidebar { overflow-x: auto; overflow-y: hidden; border-right: 0; border-bottom: 1px solid rgba(100,116,139,.22); }
          .sidebar-head { display: none; }
          .sidebar .add-course { width: auto; white-space: nowrap; }
          .course-tabs { display: flex; margin-top: 8px; }
          .course-tab { flex: 0 0 auto; width: 150px; }
          .calculator-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 620px) {
          .launcher { right: 12px; bottom: 78px; padding: 10px 12px; }
          .launcher .launch-text { display: none; }
          .overlay { padding: 0; }
          .modal { width: 100%; max-height: 100vh; height: 100vh; border: 0; border-radius: 0; }
          .modal-header { padding: 13px 14px; }
          .modal-title > span { width: 36px; height: 36px; border-radius: 11px; }
          .modal-title h2 { font-size: 16px; }
          .modal-title p { display: none; }
          .header-actions .reset-label { display: none; }
          .content { padding: 11px; }
          .course-card { padding: 12px; border-radius: 15px; }
          .overall-percent-card { grid-template-columns: 1fr; align-items: stretch; }
          .overall-input-wrap { justify-content: flex-end; min-width: 0; }
          .overall-input-wrap input { width: 130px; }
          .overall-summary { border-left: 0; border-top: 1px solid rgba(100,116,139,.22); padding: 9px 0 0; }
          .two-fields { grid-template-columns: 1fr; }
          .earned-percent-card { align-items: stretch; flex-direction: column; }
          .earned-percent-input { justify-content: flex-end; }
          .target-list { grid-template-columns: 1fr; }
          .component-row { grid-template-columns: 25px minmax(0, 1fr) minmax(80px, .55fr) 31px; }
          .component-row label:nth-of-type(3) { grid-column: 2 / 4; }
          .final-row { grid-template-columns: 1fr 82px; }
          .final-row > div:first-child { grid-column: 1 / -1; }
          .final-row::after { display: none; }
          .result-score strong { font-size: 33px; }
          .weight-inputs { grid-template-columns: 1fr 34px 1fr; }
        }
      `;
    }

    render() {
      const active = this.activeCourse();
      if (!active) {
        const course = newCourse(1);
        this.state.courses = [course];
        this.activeCourseId = course.id;
      }

      this.shadowRoot.innerHTML = `
        <style>${this.styles()}</style>
        <button type="button" class="launcher" data-action="open" aria-label="Mở bộ tính điểm môn học">
          <span class="launch-icon">🎯</span><span class="launch-text">Tính điểm môn</span>
        </button>
        ${this.open ? `
          <div class="overlay" data-action="backdrop">
            <div class="modal" tabindex="-1" role="dialog" aria-modal="true" aria-label="Bộ tính điểm môn học">
              <header class="modal-header">
                <div class="modal-title">
                  <span>🎯</span>
                  <div>
                    <h2>Tính điểm môn & điểm cần đạt</h2>
                    <p>Tự động lưu • Hỗ trợ nhiều môn • Mặc định thành phần 45% và cuối kỳ 55%</p>
                  </div>
                </div>
                <div class="header-actions">
                  <button type="button" data-action="reset-all">↺ <span class="reset-label">Xóa dữ liệu</span></button>
                  <button type="button" class="close" data-action="close" aria-label="Đóng">×</button>
                </div>
              </header>
              <div class="workspace">
                <aside class="sidebar">
                  <div class="sidebar-head"><span>DANH SÁCH MÔN</span><span>${this.state.courses.length}</span></div>
                  <button type="button" class="add-course" data-action="add-course">＋ Thêm môn</button>
                  <div class="course-tabs">
                    ${this.state.courses.map((course, index) => `
                      <button type="button" class="course-tab ${course.id === this.activeCourseId ? 'active' : ''}" data-action="select-course" data-course-id="${course.id}">
                        <span class="tab-index">${index + 1}</span>
                        <span data-tab-name="${course.id}">${escapeHTML(course.name.trim() || 'Chưa đặt tên')}</span>
                      </button>
                    `).join('')}
                  </div>
                </aside>
                <main class="content">
                  ${this.courseHTML(this.activeCourse())}
                </main>
              </div>
            </div>
          </div>
        ` : ''}
      `;
    }
  }

  if (!customElements.get('dtu-grade-target-calculator')) {
    customElements.define('dtu-grade-target-calculator', DtuGradeTargetCalculator);
  }

  const mount = () => {
    if (!document.querySelector('dtu-grade-target-calculator')) {
      document.body.appendChild(document.createElement('dtu-grade-target-calculator'));
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
