(function () {
  "use strict";

  // Позволяет CSS скрывать блоки перед появлением только тогда,
  // когда JS точно работает — иначе контент виден сразу.
  document.documentElement.classList.add("js");

  /* -----------------------------------------------------------
     Укажите адрес обработчика формы заказа (Formspree, Telegram-
     бот, Google Apps Script и т.п.). Пример для Formspree:
       const ORDER_FORM_ENDPOINT = "https://formspree.io/f/xxxxxxx";
     Если оставить пустым — форма работает в демо-режиме: просто
     показывает подтверждение, никуда ничего не отправляя.
     ----------------------------------------------------------- */
  const ORDER_FORM_ENDPOINT = "https://formspree.io/f/xzdnwaje";

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ================= год в подвале ================= */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

  /* ================= прогресс скролла — "стежок" ================= */
  (function () {
    let ticking = false;
    function updateProgress() {
      const scrollTop = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
      document.documentElement.style.setProperty("--scroll-progress", fraction.toFixed(4));
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(updateProgress);
        ticking = true;
      }
    }, { passive: true });
    updateProgress();
  })();

  /* ================= "нить" за курсором — теперь замена системного курсора =================
     Только для мыши и без reduced-motion: иначе людям буквально не за чем
     будет следить на экране. Родной курсор прячется через custom-cursor-active
     на <html> (см. CSS) — кроме текстовых полей, там он остаётся. */
  if (hasFinePointer && !prefersReducedMotion) {
    const threadSvg = document.querySelector("[data-thread-cursor]");
    const threadPath = document.querySelector("[data-thread-path]");
    const threadNeedle = document.querySelector("[data-thread-needle]");

    if (threadSvg && threadPath && threadNeedle) {
      document.documentElement.classList.add("custom-cursor-active");

      const points = [];
      const MAX_POINTS = 10;
      let trailTimeout = null;
      let hasShown = false;

      function resizeThreadSvg() {
        threadSvg.setAttribute("viewBox", "0 0 " + window.innerWidth + " " + window.innerHeight);
      }
      resizeThreadSvg();
      window.addEventListener("resize", resizeThreadSvg);

      function drawTrail() {
        if (points.length < 2) {
          threadPath.setAttribute("d", "");
          return;
        }
        let d = "M " + points[0].x + " " + points[0].y;
        for (let i = 1; i < points.length; i++) {
          d += " L " + points[i].x + " " + points[i].y;
        }
        threadPath.setAttribute("d", d);
      }

      document.addEventListener("mousemove", function (e) {
        if (!hasShown) {
          threadSvg.classList.add("is-active");
          hasShown = true;
        }
        // остриё "иголки" всегда стоит там же, где курсор — это и есть
        // замена системного указателя, а не просто уходящий след
        threadNeedle.setAttribute("cx", e.clientX);
        threadNeedle.setAttribute("cy", e.clientY);

        points.push({ x: e.clientX, y: e.clientY });
        if (points.length > MAX_POINTS) points.shift();
        drawTrail();

        // сам "хвост" нити угасает, если мышь остановилась — но точка
        // курсора при этом никуда не пропадает
        clearTimeout(trailTimeout);
        trailTimeout = setTimeout(function () {
          points.length = 0;
          threadPath.setAttribute("d", "");
        }, 500);
      });

      document.documentElement.addEventListener("mouseleave", function () {
        threadSvg.classList.remove("is-active");
        hasShown = false;
        points.length = 0;
        threadPath.setAttribute("d", "");
      });

      // лёгкая подсказка "тут можно нажать" вместо родного pointer-курсора
      document.querySelectorAll("a, button, .btn, select, input[type='checkbox']").forEach(function (el) {
        el.addEventListener("mouseenter", function () {
          threadSvg.classList.add("is-hovering");
        });
        el.addEventListener("mouseleave", function () {
          threadSvg.classList.remove("is-hovering");
        });
      });
    }
  }

  /* ================= "прожектор" — динамический фокус на герое ================= */
  if (hasFinePointer && !prefersReducedMotion) {
    const heroCard = document.querySelector(".hero-card");
    if (heroCard) {
      heroCard.addEventListener("mousemove", function (e) {
        const rect = heroCard.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        heroCard.style.setProperty("--spot-x", x + "%");
        heroCard.style.setProperty("--spot-y", y + "%");
        heroCard.classList.add("spotlight-active");
      });
      heroCard.addEventListener("mouseleave", function () {
        heroCard.classList.remove("spotlight-active");
      });
    }
  }

  /* ================= разрез шва ножницами =================
     Работает и мышью, и пальцем (Pointer Events). Порог завершения —
     половина пути: дотянул больше половины и отпустил — дорезает само,
     меньше половины — шов возвращается на место. Enter/Space/→ на
     фокусе — доступная альтернатива перетаскиванию. */
  (function () {
    const seamCut = document.querySelector("[data-seam-cut]");
    const track = document.querySelector("[data-seam-track]");
    const handle = document.querySelector("[data-seam-handle]");
    const flap = document.querySelector("[data-seam-flap]");
    if (!seamCut || !track || !handle || !flap) return;

    const HANDLE_SIZE = 44;
    let maxCutX = 0;
    let cutX = 0;
    let dragging = false;
    let completed = false;

    function measure() {
      maxCutX = Math.max(0, track.getBoundingClientRect().width - HANDLE_SIZE);
    }
    measure();
    window.addEventListener("resize", measure);

    function setPosition(x) {
      cutX = Math.max(0, Math.min(x, maxCutX));
      handle.style.transform = "translate(" + cutX + "px, -50%)";
      flap.style.clipPath = "inset(0 0 0 " + (cutX + HANDLE_SIZE) + "px)";
    }

    function complete() {
      if (completed) return;
      completed = true;
      setPosition(maxCutX);
      seamCut.classList.remove("is-dragging");
      seamCut.classList.add("is-cut");
      handle.setAttribute("aria-label", "Шов уже разрезан");
      handle.disabled = true;
    }

    function cancel() {
      setPosition(0);
      seamCut.classList.remove("is-dragging");
    }

    function onPointerDown(e) {
      if (completed) return;
      measure();
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      seamCut.classList.add("is-dragging");
      handle.style.transition = "none";
      flap.style.transition = "none";
    }

    function onPointerMove(e) {
      if (!dragging || completed) return;
      const rect = track.getBoundingClientRect();
      setPosition(e.clientX - rect.left - HANDLE_SIZE / 2);
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      handle.style.transition = "";
      flap.style.transition = "";
      if (cutX >= maxCutX * 0.5) {
        complete();
      } else {
        cancel();
      }
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);

    handle.addEventListener("keydown", function (e) {
      if (completed) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        measure();
        complete();
      }
    });
  })();

  /* ================= мобильное меню ================= */
  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      const isOpen = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", String(!isOpen));
      navToggle.setAttribute("aria-expanded", String(!isOpen));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.setAttribute("data-open", "false");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        nav.setAttribute("data-open", "false");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ================= подсветка активного пункта меню ================= */
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll(".nav a[href^='#']");

  if (sections.length && navLinks.length && "IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navLinks.forEach(function (link) {
              link.classList.toggle(
                "is-active",
                link.getAttribute("href") === "#" + entry.target.id
              );
            });
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach(function (s) {
      navObserver.observe(s);
    });
  }

  /* ================= анимация появления блоков при скролле ================= */
  const revealEls = document.querySelectorAll(".reveal");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    const revealObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ================= кнопка "Позвонить мастеру" ================= */
  const callBtn = document.querySelector("[data-call-btn]");
  if (callBtn) {
    callBtn.addEventListener("click", function () {
      // tel:-ссылка продолжает работать как обычно (на телефоне откроется
      // звонок), а здесь просто даём понятную визуальную реакцию на клик —
      // название кнопки плавно сменяется номером.
      callBtn.classList.add("is-revealed");
    });
  }

  /* ================= маска телефона ================= */
  const phoneInput = document.getElementById("of-phone");

  if (phoneInput) {
    phoneInput.addEventListener("input", function () {
      let digits = phoneInput.value.replace(/\D/g, "");

      if (digits.startsWith("8")) digits = "7" + digits.slice(1);
      if (!digits.startsWith("7")) digits = "7" + digits;
      digits = digits.slice(0, 11);

      const d = digits.slice(1); // цифры после "7"
      let out = "+7";
      if (d.length > 0) out += " (" + d.slice(0, 3);
      if (d.length >= 3) out += ")";
      if (d.length > 3) out += " " + d.slice(3, 6);
      if (d.length > 6) out += "-" + d.slice(6, 8);
      if (d.length > 8) out += "-" + d.slice(8, 10);

      phoneInput.value = out;
    });
  }

  /* ================= форма заказа ================= */
  const form = document.getElementById("order-form");
  const confirmBlock = document.querySelector("[data-order-confirm]");

  function setError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.querySelector(
      '[data-error-for="' + fieldId + '"]'
    );
    const row = field ? field.closest(".form-row") : null;

    if (errorEl) errorEl.textContent = message || "";
    if (row) row.classList.toggle("has-error", Boolean(message));
    if (!row && field) {
      // чекбокс согласия не обёрнут в .form-row
      field.setAttribute("aria-invalid", message ? "true" : "false");
    }
  }

  function validateForm(data) {
    let firstInvalid = null;

    if (!data.name.trim()) {
      setError("of-name", "Подскажите, как к вам обращаться");
      firstInvalid = firstInvalid || "of-name";
    } else {
      setError("of-name", "");
    }

    const phoneDigits = data.phone.replace(/\D/g, "");
    if (phoneDigits.length < 11) {
      setError("of-phone", "Проверьте номер телефона");
      firstInvalid = firstInvalid || "of-phone";
    } else {
      setError("of-phone", "");
    }

    if (!data.consent) {
      setError("of-consent", "Нужно согласие на обработку данных");
      firstInvalid = firstInvalid || "of-consent";
    } else {
      setError("of-consent", "");
    }

    return firstInvalid;
  }

  function showConfirmation() {
    if (!form || !confirmBlock) return;
    form.hidden = true;
    confirmBlock.hidden = false;
    confirmBlock.querySelector(".stamp").style.animation = "none";
    // перезапуск CSS-анимации штампа
    void confirmBlock.offsetWidth;
    confirmBlock.querySelector(".stamp").style.animation = "";
    confirmBlock.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const data = {
        name: form.name.value,
        phone: form.phone.value,
        service: form.service.value,
        message: form.message.value,
        consent: form.consent.checked,
      };

      const firstInvalid = validateForm(data);
      if (firstInvalid) {
        document.getElementById(firstInvalid).focus();
        return;
      }

      const submitBtn = form.querySelector(".btn-submit");
      submitBtn.disabled = true;
      submitBtn.querySelector(".btn-label").textContent = "Отправляем…";

      const finish = function () {
        showConfirmation();
      };

      if (ORDER_FORM_ENDPOINT) {
        fetch(ORDER_FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data),
        })
          .then(function (response) {
            if (!response.ok) throw new Error("submit failed");
            finish();
          })
          .catch(function () {
            submitBtn.disabled = false;
            submitBtn.querySelector(".btn-label").textContent = "Отправить заявку";
            alert(
              "Не получилось отправить заявку. Позвоните, пожалуйста: 8 (908) 154-84-46"
            );
          });
      } else {
        // демо-режим — без реальной отправки
        setTimeout(finish, 350);
      }
    });
  }
})();
