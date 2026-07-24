(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Replace missing images with the styled image-shell fallback.
  const initImageFallbacks = () => {
    document.querySelectorAll('img[data-fallback]').forEach((image) => {
      const showFallback = () => {
        image.hidden = true;
        image.closest('.image-shell, .hero-slide, .marquee__group')?.classList.add('has-image-error');
      };

      image.addEventListener('error', showFallback, { once: true });

      if (image.complete && image.naturalWidth === 0) {
        showFallback();
      }
    });
  };

  // Fixed header state and back-to-top visibility share one light scroll update.
  const initScrollChrome = () => {
    const header = document.getElementById('site-header');
    const backToTop = document.getElementById('back-to-top');
    let ticking = false;

    const update = () => {
      const scrollY = window.scrollY;
      header?.classList.toggle('is-scrolled', scrollY > 60);
      backToTop?.classList.toggle('is-visible', scrollY > window.innerHeight * 0.8);
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    backToTop?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    });

    update();
  };

  // Full-screen menu: focus trapping, Escape closing, inert page content.
  const initNavigation = () => {
    const menuButton = document.getElementById('menu-toggle');
    const overlay = document.getElementById('navigation-overlay');
    const closeButton = document.getElementById('nav-close');

    if (!menuButton || !overlay || !closeButton) return;

    const pageRegions = [
      document.querySelector('main'),
      document.querySelector('.site-footer'),
      document.getElementById('back-to-top'),
      document.getElementById('site-header')
    ].filter(Boolean);

    let previouslyFocused = null;

    const focusableElements = () => Array.from(overlay.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));

    const setPageInert = (isInert) => {
      pageRegions.forEach((region) => {
        if (isInert) {
          region.setAttribute('inert', '');
        } else {
          region.removeAttribute('inert');
        }
      });
    };

    const openMenu = () => {
      previouslyFocused = document.activeElement;
      overlay.removeAttribute('inert');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      menuButton.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      setPageInert(true);
      window.requestAnimationFrame(() => closeButton.focus());
    };

    const closeMenu = () => {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('inert', '');
      menuButton.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      setPageInert(false);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };

    menuButton.addEventListener('click', openMenu);
    closeButton.addEventListener('click', closeMenu);

    overlay.querySelectorAll('[data-menu-link]').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  };

  // Hero slider: crossfade transitions, 6-second autoplay and tab visibility pause.
  const initHeroSlider = () => {
    const slides = Array.from(document.querySelectorAll('.hero-slide'));
    const previousButton = document.getElementById('hero-prev');
    const nextButton = document.getElementById('hero-next');

    if (slides.length < 2 || !previousButton || !nextButton) return;

    let index = 0;
    let timer = null;
    let transitionTimer = 0;
    let isTransitioning = false;

    const render = () => {
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle('is-active', slideIndex === index);
      });
    };

    const unlockTransition = () => {
      window.clearTimeout(transitionTimer);
      transitionTimer = 0;
      isTransitioning = false;
      previousButton.disabled = false;
      nextButton.disabled = false;
    };

    const move = (direction) => {
      if (isTransitioning) return false;
      index = (index + direction + slides.length) % slides.length;
      render();

      if (!reducedMotion.matches) {
        isTransitioning = true;
        previousButton.disabled = true;
        nextButton.disabled = true;

        const activeSlide = slides[index];
        const handleTransitionEnd = (event) => {
          if (event.target !== activeSlide || event.propertyName !== 'opacity') return;
          activeSlide.removeEventListener('transitionend', handleTransitionEnd);
          unlockTransition();
        };

        activeSlide.addEventListener('transitionend', handleTransitionEnd);
        transitionTimer = window.setTimeout(() => {
          activeSlide.removeEventListener('transitionend', handleTransitionEnd);
          unlockTransition();
        }, 1400);
      }

      return true;
    };

    const stop = () => {
      window.clearInterval(timer);
      timer = null;
    };

    const start = () => {
      stop();
      if (!reducedMotion.matches && !document.hidden) {
        timer = window.setInterval(() => move(1), 6000);
      }
    };

    previousButton.addEventListener('click', () => {
      if (move(-1)) start();
    });

    nextButton.addEventListener('click', () => {
      if (move(1)) start();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });

    reducedMotion.addEventListener?.('change', start);
    render();
    start();
  };

  // Location film: play only while visible and preserve the poster if the MP4 is unavailable.
  const initLocationVideo = () => {
    const media = document.getElementById('location-video-wrap');
    const video = document.getElementById('location-video');
    const source = video?.querySelector('source');

    if (!media || !video || !source) return;

    let isVisible = false;
    let isUnavailable = false;

    const pauseVideo = () => video.pause();

    const markUnavailable = () => {
      isUnavailable = true;
      pauseVideo();
      media.classList.add('is-unavailable');
    };

    const playVideo = () => {
      if (!isVisible || isUnavailable || reducedMotion.matches) return;
      video.muted = true;
      const playPromise = video.play();
      playPromise?.catch(() => {
        if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
          markUnavailable();
        }
      });
    };

    source.addEventListener('error', markUnavailable, { once: true });
    video.addEventListener('error', markUnavailable, { once: true });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.3;
        if (isVisible) {
          playVideo();
        } else {
          pauseVideo();
        }
      }, { threshold: [0, 0.3, 1] });

      observer.observe(media);
    }

    reducedMotion.addEventListener?.('change', () => {
      if (reducedMotion.matches) {
        pauseVideo();
      } else {
        playVideo();
      }
    });

    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) markUnavailable();
  };

  // IntersectionObserver-powered content reveals with small, bounded staggers.
  const initReveals = () => {
    const items = Array.from(document.querySelectorAll('.reveal'));
    if (!items.length) return;

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const siblings = Array.from(entry.target.parentElement?.children || []);
        const localIndex = Math.max(0, siblings.indexOf(entry.target));
        entry.target.style.transitionDelay = `${Math.min(localIndex * 70, 280)}ms`;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    items.forEach((item) => observer.observe(item));
  };

  // Gallery carousel: three fixed slots eliminate DOM-order problems at the 1/6 boundary.
  const initGallery = () => {
    const carousel = document.getElementById('gallery-carousel');
    const viewport = document.getElementById('gallery-viewport');
    const previousSlot = viewport?.querySelector('.gallery-slot--previous');
    const activeSlot = viewport?.querySelector('.gallery-slot--active');
    const nextSlot = viewport?.querySelector('.gallery-slot--next');
    const previousButton = document.getElementById('gallery-prev');
    const nextButton = document.getElementById('gallery-next');
    const dotsRoot = document.getElementById('gallery-dots');
    const status = document.getElementById('gallery-status');

    const items = [
      { src: new URL('./assets/images/gallery-01.jpg', import.meta.url).href, alt: 'The navy and bronze interior of Deuces' },
      { src: new URL('./assets/images/gallery-02.jpg', import.meta.url).href, alt: 'Friends enjoying an evening together' },
      { src: new URL('./assets/images/gallery-03.jpg', import.meta.url).href, alt: 'Shisha, cocktail and tea on a lounge table' },
      { src: new URL('./assets/images/gallery-04.jpg', import.meta.url).href, alt: 'A signature cocktail in warm evening light' },
      { src: new URL('./assets/images/gallery-05.jpg', import.meta.url).href, alt: 'Middle Eastern bites prepared for sharing' },
      { src: new URL('./assets/images/gallery-06.jpg', import.meta.url).href, alt: 'The welcoming entrance to the lounge at night' }
    ];

    if (!carousel || !viewport || !previousSlot || !activeSlot || !nextSlot || !previousButton || !nextButton || !dotsRoot) return;

    let index = 1;
    let pointerStart = null;
    let activePointer = null;
    let transitionTimer = 0;
    let isAnimating = false;
    let runningAnimations = [];
    let transitionImages = [];

    items.forEach((item) => {
      const preload = new Image();
      preload.src = item.src;
    });

    const dots = items.map((_, itemIndex) => {
      const dot = document.createElement('button');
      dot.className = 'gallery-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show gallery image ${itemIndex + 1}`);
      dotsRoot.append(dot);
      return dot;
    });

    const setSlotImage = (slot, item, exposeAlt) => {
      const image = slot.querySelector('img');
      if (!image) return;
      image.src = item.src;
      image.alt = exposeAlt ? item.alt : '';
    };

    const render = () => {
      const previousIndex = (index - 1 + items.length) % items.length;
      const nextIndex = (index + 1) % items.length;

      setSlotImage(previousSlot, items[previousIndex], false);
      setSlotImage(activeSlot, items[index], true);
      setSlotImage(nextSlot, items[nextIndex], false);

      dots.forEach((dot, dotIndex) => {
        const isActive = dotIndex === index;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      });

      if (status) status.textContent = `Gallery image ${index + 1} of ${items.length}`;
    };

    const setControlsDisabled = (disabled) => {
      previousButton.disabled = disabled;
      nextButton.disabled = disabled;
      dots.forEach((dot) => {
        dot.disabled = disabled;
      });
    };

    const finishTransition = () => {
      window.clearTimeout(transitionTimer);
      transitionTimer = 0;
      runningAnimations.forEach((animation) => animation.cancel());
      runningAnimations = [];
      transitionImages.forEach((image) => image.remove());
      transitionImages = [];
      carousel.classList.remove('is-moving-forward', 'is-moving-backward');
      isAnimating = false;
      setControlsDisabled(false);
    };

    const getDirectionTo = (targetIndex) => {
      const forwardDistance = (targetIndex - index + items.length) % items.length;
      const backwardDistance = (index - targetIndex + items.length) % items.length;
      return forwardDistance <= backwardDistance ? 1 : -1;
    };

    const animateTo = (targetIndex, direction) => {
      const offset = Math.min(viewport.clientWidth * 0.025, 28) * direction;
      const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

      if (reducedMotion.matches || typeof viewport.animate !== 'function') {
        index = targetIndex;
        render();
        finishTransition();
        return;
      }

      carousel.classList.add(direction > 0 ? 'is-moving-forward' : 'is-moving-backward');
      const targetIndices = [
        (targetIndex - 1 + items.length) % items.length,
        targetIndex,
        (targetIndex + 1) % items.length
      ];

      runningAnimations = [previousSlot, activeSlot, nextSlot].flatMap((slot, slotIndex) => {
        const outgoingImage = slot.querySelector('img');
        if (!outgoingImage) return [];

        const incomingImage = outgoingImage.cloneNode(false);
        incomingImage.classList.add('gallery-slot__incoming');
        incomingImage.src = items[targetIndices[slotIndex]].src;
        incomingImage.alt = '';
        slot.append(incomingImage);
        transitionImages.push(incomingImage);

        const options = {
          duration: 560,
          easing,
          fill: 'forwards'
        };

        return [
          outgoingImage.animate([
            { transform: 'translate3d(0, 0, 0)', opacity: 1 },
            { transform: `translate3d(${-offset}px, 0, 0)`, opacity: 0 }
          ], options),
          incomingImage.animate([
            { transform: `translate3d(${offset}px, 0, 0)`, opacity: 0 },
            { transform: 'translate3d(0, 0, 0)', opacity: 1 }
          ], options)
        ];
      });

      Promise.allSettled(runningAnimations.map((animation) => animation.finished)).then(() => {
        if (!isAnimating) return;
        index = targetIndex;
        render();
        finishTransition();
      });

      transitionTimer = window.setTimeout(() => {
        if (isAnimating) {
          index = targetIndex;
          render();
          finishTransition();
        }
      }, 720);
    };

    const setIndex = (nextIndex, directionHint = 0) => {
      const targetIndex = (nextIndex + items.length) % items.length;
      if (targetIndex === index || isAnimating) return;
      const direction = directionHint || getDirectionTo(targetIndex);
      isAnimating = true;
      setControlsDisabled(true);
      animateTo(targetIndex, direction);
    };

    const move = (direction) => setIndex((index + direction + items.length) % items.length, direction);

    previousButton.addEventListener('click', () => move(-1));
    nextButton.addEventListener('click', () => move(1));
    dots.forEach((dot, dotIndex) => {
      dot.addEventListener('click', () => setIndex(dotIndex, getDirectionTo(dotIndex)));
    });

    carousel.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(1);
      }
    });

    viewport.addEventListener('pointerdown', (event) => {
      if (isAnimating || (event.pointerType === 'mouse' && event.button !== 0)) return;
      activePointer = event.pointerId;
      pointerStart = event.clientX;
      viewport.setPointerCapture?.(event.pointerId);
    });

    const endPointer = (event) => {
      if (activePointer !== event.pointerId || pointerStart === null) return;
      const distance = event.clientX - pointerStart;
      if (Math.abs(distance) > 48) move(distance > 0 ? -1 : 1);
      pointerStart = null;
      activePointer = null;
    };

    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);

    render();
  };

  const initFooter = () => {
    const year = document.getElementById('copyright-year');
    if (year) year.textContent = String(new Date().getFullYear());
  };

  initImageFallbacks();
  initScrollChrome();
  initNavigation();
  initHeroSlider();
  initLocationVideo();
  initReveals();
  initGallery();
  initFooter();
})();
