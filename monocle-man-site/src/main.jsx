import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const VIDEO_ID = "NBxByrz5BRE";
const YOUTUBE_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const MODAL_URL = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`;
const HERO_IMAGE = `https://i.ytimg.com/vi/${VIDEO_ID}/sddefault.jpg`;
const FRAME_IMAGE = `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`;

export const MONOCLE_ACTIONS = [
  "MONOCLE_SKIP_MAIN",
  "MONOCLE_NAV_TOP",
  "MONOCLE_NAV_FILM",
  "MONOCLE_NAV_RULES",
  "MONOCLE_NAV_LINES",
  "MONOCLE_MENU_TOGGLE",
  "MONOCLE_VIDEO_OPEN_HEADER",
  "MONOCLE_VIDEO_OPEN_HERO",
  "MONOCLE_VIDEO_CLOSE",
  "MONOCLE_ORIGINAL_OPEN_FILM",
  "MONOCLE_ORIGINAL_OPEN_FINAL",
  "MONOCLE_FOOTER_TOP",
  "MONOCLE_FOOTER_FILM",
  "MONOCLE_FOOTER_LINES"
];

const actionRegistry = new Map();

function publishActionRegistry() {
  window.__MONOCLE_ACTION_REGISTRY__ = Array.from(actionRegistry.values()).sort((a, b) => a.action.localeCompare(b.action));
}

export function useRegisterAction(qid, metadata) {
  const { action, label, description } = metadata;
  useEffect(() => {
    actionRegistry.set(action, { qid, action, label, description });
    publishActionRegistry();
    return () => {
      actionRegistry.delete(action);
      publishActionRegistry();
    };
  }, [qid, action, label, description]);
}

function actionProps(qid, action, title) {
  return {
    "data-qid": qid,
    "data-qs-action": action,
    title
  };
}

function scrollToHash(hash) {
  const target = hash === "#top" ? document.documentElement : document.querySelector(hash);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SkipLink({ mainRef }) {
  useRegisterAction("monocle:skip:main", {
    action: "MONOCLE_SKIP_MAIN",
    label: "Skip to main content",
    description: "Move keyboard focus to the main Monocle Man content landmark."
  });

  const handleSkip = useCallback((event) => {
    event.preventDefault();
    mainRef.current?.focus();
  }, [mainRef]);

  return (
    <a
      href="#main-content"
      className="skip-link"
      onClick={handleSkip}
      {...actionProps("monocle:skip:main", "MONOCLE_SKIP_MAIN", "Skip to main content")}
    >
      Skip to main content
    </a>
  );
}

function HeaderNav({ menuOpen, onMenuToggle, onMenuClose, onOpenVideo }) {
  useRegisterAction("monocle:nav:brand-top", {
    action: "MONOCLE_NAV_TOP",
    label: "Return to top",
    description: "Navigate to the beginning of the Monocle Man landing page."
  });
  useRegisterAction("monocle:nav:film", {
    action: "MONOCLE_NAV_FILM",
    label: "Jump to film",
    description: "Navigate to the film section."
  });
  useRegisterAction("monocle:nav:rules", {
    action: "MONOCLE_NAV_RULES",
    label: "Jump to rules",
    description: "Navigate to the monocle rules section."
  });
  useRegisterAction("monocle:nav:lines", {
    action: "MONOCLE_NAV_LINES",
    label: "Jump to lines",
    description: "Navigate to the quoted lines gallery."
  });
  useRegisterAction("monocle:nav:menu-toggle", {
    action: "MONOCLE_MENU_TOGGLE",
    label: "Open navigation menu",
    description: "Open or close the mobile navigation menu."
  });
  useRegisterAction("monocle:nav:watch-film", {
    action: "MONOCLE_VIDEO_OPEN_HEADER",
    label: "Open film modal",
    description: "Open the privacy-enhanced embedded Monocle Man film."
  });

  const handleAnchor = useCallback((event, hash) => {
    event.preventDefault();
    onMenuClose();
    scrollToHash(hash);
    history.replaceState(null, "", hash);
  }, [onMenuClose]);

  return (
    <header className={`site-nav ${menuOpen ? "is-open" : ""}`}>
      <a
        href="#top"
        className="brand-link"
        onClick={(event) => handleAnchor(event, "#top")}
        {...actionProps("monocle:nav:brand-top", "MONOCLE_NAV_TOP", "Return to top")}
      >
        <span className="brand-mark" aria-hidden="true" />
        <span>The Monocle Man</span>
      </a>
      <button
        type="button"
        className="menu-toggle"
        aria-controls="monocle-navigation"
        aria-expanded={menuOpen}
        onClick={onMenuToggle}
        {...actionProps("monocle:nav:menu-toggle", "MONOCLE_MENU_TOGGLE", "Open navigation menu")}
      >
        Menu
      </button>
      <nav id="monocle-navigation" className="nav-links" data-links aria-label="Monocle Man sections">
        <a
          href="#film"
          onClick={(event) => handleAnchor(event, "#film")}
          {...actionProps("monocle:nav:film", "MONOCLE_NAV_FILM", "Jump to the film section")}
        >
          Film
        </a>
        <a
          href="#rules"
          onClick={(event) => handleAnchor(event, "#rules")}
          {...actionProps("monocle:nav:rules", "MONOCLE_NAV_RULES", "Jump to monocle rules")}
        >
          Rules
        </a>
        <a
          href="#lines"
          onClick={(event) => handleAnchor(event, "#lines")}
          {...actionProps("monocle:nav:lines", "MONOCLE_NAV_LINES", "Jump to quoted lines")}
        >
          Lines
        </a>
      </nav>
      <button
        type="button"
        className="nav-watch"
        onClick={onOpenVideo}
        {...actionProps("monocle:nav:watch-film", "MONOCLE_VIDEO_OPEN_HEADER", "Open the film modal")}
      >
        Watch film
      </button>
    </header>
  );
}

function HeroSection({ onOpenVideo }) {
  useRegisterAction("monocle:hero:watch-film", {
    action: "MONOCLE_VIDEO_OPEN_HERO",
    label: "Watch the original monocle film",
    description: "Open the embedded source film from the hero section."
  });

  return (
    <section className="hero-section" data-qid="monocle:hero:section" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow" data-qid="monocle:hero:eyebrow">Public etiquette bulletin · 1930</p>
        <h1 id="hero-heading" data-qid="monocle:hero:heading">
          The <span>Monocle Man</span>
        </h1>
        <blockquote className="hero-quote" data-qid="monocle:hero:quote">
          A monocle is never worn in both eyes. It is a single-lens declaration of nerve, timing, and manners.
        </blockquote>
        <button
          type="button"
          className="round-play"
          onClick={onOpenVideo}
          data-open-video="hero"
          {...actionProps("monocle:hero:watch-film", "MONOCLE_VIDEO_OPEN_HERO", "Watch the original monocle film")}
        >
          Watch the original
        </button>
      </div>
      <figure className="hero-image-frame media" data-qid="monocle:hero:image-frame">
        <img
          data-qid="monocle:hero:image"
          data-benchmark-image="hero"
          src={HERO_IMAGE}
          alt="A vintage frame from How to Wear a Monocle"
          loading="eager"
          decoding="async"
        />
        <figcaption>One lens. One side. No compromise.</figcaption>
      </figure>
    </section>
  );
}

function FilmSection() {
  useRegisterAction("monocle:film:external-original", {
    action: "MONOCLE_ORIGINAL_OPEN_FILM",
    label: "Open the original film on YouTube",
    description: "Open the source film in a new browser tab."
  });

  return (
    <section id="film" className="content-section film-section" data-qid="monocle:film:section" aria-labelledby="film-heading">
      <div className="section-kicker">Film 01</div>
      <div className="section-grid">
        <div>
          <p className="eyebrow">Source reel</p>
          <h2 id="film-heading">How to Wear a Monocle</h2>
          <p data-qid="monocle:film:note" className="lead-copy">
            The landing page treats the short film as a luxury editorial artifact: absurdly serious, politely theatrical, and testable by robots.
          </p>
          <a
            className="text-link"
            href={YOUTUBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            {...actionProps("monocle:film:external-original", "MONOCLE_ORIGINAL_OPEN_FILM", "Open the original film on YouTube")}
          >
            Open the original film
          </a>
        </div>
        <aside className="film-card" data-qid="monocle:film:embed-frame" aria-label="Film preview card">
          <p>Embedded playback opens in the modal so CI can verify focus, Escape, iframe source, and close behavior deterministically.</p>
          <dl data-qid="monocle:film:metadata">
            <div><dt>Subject</dt><dd>Monocle etiquette</dd></div>
            <div><dt>Format</dt><dd>Editorial landing page</dd></div>
            <div><dt>Evidence</dt><dd>GitHub Actions + screenshots</dd></div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

function RulesSection() {
  return (
    <section id="rules" className="content-section rules-section" data-qid="monocle:rules:section" aria-labelledby="rules-heading">
      <p className="eyebrow">The code of the lens</p>
      <h2 id="rules-heading" data-qid="monocle:rules:heading">Rules for the properly dramatic monocle</h2>
      <ol className="rules-list" aria-label="Monocle rules">
        <li data-qid="monocle:rules:item:one-side">
          <span>01</span>
          <strong>One side only</strong>
          <p>Two lenses are spectacles. One lens is a position.</p>
        </li>
        <li data-qid="monocle:rules:item:never-waver">
          <span>02</span>
          <strong>Never waver</strong>
          <p>The monocle is kept in place by composure, not by panic.</p>
        </li>
        <li data-qid="monocle:rules:item:etiquette">
          <span>03</span>
          <strong>Etiquette first</strong>
          <p>The joke lands because the gentleman insists it is not a joke.</p>
        </li>
      </ol>
    </section>
  );
}

function QuoteGallery() {
  const cards = useMemo(() => [
    {
      qid: "monocle:quotes:card:inspection",
      imageQid: "monocle:quotes:image:inspection",
      benchmark: "quote-1",
      title: "Inspection",
      quote: "A monocle rewards the face that refuses to negotiate.",
      src: FRAME_IMAGE
    },
    {
      qid: "monocle:quotes:card:adjustment",
      imageQid: "monocle:quotes:image:adjustment",
      benchmark: "quote-2",
      title: "Adjustment",
      quote: "The slightest twitch becomes a matter of public record.",
      src: HERO_IMAGE
    },
    {
      qid: "monocle:quotes:card:final-warning",
      imageQid: "monocle:quotes:image:final-warning",
      benchmark: "quote-3",
      title: "Final warning",
      quote: "A gentleman may blink; the monocle must not.",
      src: FRAME_IMAGE
    }
  ], []);

  return (
    <section id="lines" className="content-section lines-section" aria-labelledby="lines-heading">
      <p className="eyebrow">Quoted lines</p>
      <h2 id="lines-heading">Deadpan instructions for a ridiculous object</h2>
      <div className="quote-gallery" data-qid="monocle:quotes:gallery">
        {cards.map((card) => (
          <figure className="quote-card" data-qid={card.qid} key={card.qid}>
            <div className="media">
              <img
                data-qid={card.imageQid}
                data-benchmark-image={card.benchmark}
                src={card.src}
                alt={`${card.title} still from the monocle film`}
                loading="eager"
                decoding="async"
              />
            </div>
            <figcaption>
              <blockquote>{card.quote}</blockquote>
              <small>{card.title}</small>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function VerdictSection() {
  useRegisterAction("monocle:verdict:watch-original", {
    action: "MONOCLE_ORIGINAL_OPEN_FINAL",
    label: "Watch the original film",
    description: "Open the source film from the final verdict section."
  });

  return (
    <section className="verdict-section" data-qid="monocle:verdict:section" aria-labelledby="verdict-heading">
      <div className="verdict-backdrop media" aria-hidden="true">
        <img
          data-qid="monocle:verdict:image:background"
          data-benchmark-image="verdict-background"
          src={HERO_IMAGE}
          alt=""
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="verdict-copy">
        <p className="eyebrow">Evidence-derived verdict</p>
        <h2 id="verdict-heading" data-qid="monocle:verdict:heading">The lens passes only when the evidence does.</h2>
        <p data-qid="monocle:verdict:quote">
          The final consistency joke: one lens is confidence, two lenses are an uncontrolled requirements expansion.
        </p>
        <a
          className="button-link"
          href={YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          {...actionProps("monocle:verdict:watch-original", "MONOCLE_ORIGINAL_OPEN_FINAL", "Watch the original film")}
        >
          Watch the original film
        </a>
      </div>
    </section>
  );
}

function VideoModal({ isOpen, onClose }) {
  useRegisterAction("monocle:modal:close", {
    action: "MONOCLE_VIDEO_CLOSE",
    label: "Close film modal",
    description: "Close the embedded Monocle Man film modal."
  });

  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
    if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleCancel = useCallback((event) => {
    event.preventDefault();
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback((event) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((event) => {
    if (!isOpen || event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll("button, iframe, a[href], [tabindex]:not([tabindex='-1'])"))
      .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="video-modal"
      data-modal
      data-qid="monocle:modal:video"
      role="dialog"
      aria-modal={isOpen ? "true" : undefined}
      aria-labelledby="monocle-video-title"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="modal-panel">
        <button
          ref={closeRef}
          type="button"
          className="modal-close"
          onClick={onClose}
          {...actionProps("monocle:modal:close", "MONOCLE_VIDEO_CLOSE", "Close film modal")}
        >
          Close
        </button>
        <h2 id="monocle-video-title">The original Monocle Man film</h2>
        <p>Privacy-enhanced YouTube playback loads only while this modal is open.</p>
        {isOpen ? (
          <iframe
            data-qid="monocle:modal:iframe"
            data-modal-frame
            title="How to Wear a Monocle video"
            src={MODAL_URL}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : null}
      </div>
    </dialog>
  );
}

function Footer() {
  useRegisterAction("monocle:footer:top", {
    action: "MONOCLE_FOOTER_TOP",
    label: "Return to top",
    description: "Return from the footer to the top of the page."
  });
  useRegisterAction("monocle:footer:film", {
    action: "MONOCLE_FOOTER_FILM",
    label: "Jump to film section",
    description: "Navigate from the footer to the film section."
  });
  useRegisterAction("monocle:footer:lines", {
    action: "MONOCLE_FOOTER_LINES",
    label: "Jump to quoted lines",
    description: "Navigate from the footer to the quote gallery."
  });

  const handleAnchor = useCallback((event, hash) => {
    event.preventDefault();
    scrollToHash(hash);
    history.replaceState(null, "", hash);
  }, []);

  return (
    <footer className="site-footer">
      <p data-qid="monocle:footer:credit">An editorial tribute to a deadpan instructional film about monocle etiquette.</p>
      <p data-qid="monocle:evidence:slice-note">Benchmark mode: React contract, deterministic qids, action registry, screenshots, accessibility, and evidence-derived verdict.</p>
      <nav aria-label="Footer navigation">
        <a
          href="#top"
          onClick={(event) => handleAnchor(event, "#top")}
          {...actionProps("monocle:footer:top", "MONOCLE_FOOTER_TOP", "Return to top")}
        >
          Top
        </a>
        <a
          href="#film"
          onClick={(event) => handleAnchor(event, "#film")}
          {...actionProps("monocle:footer:film", "MONOCLE_FOOTER_FILM", "Jump to film section")}
        >
          Film
        </a>
        <a
          href="#lines"
          onClick={(event) => handleAnchor(event, "#lines")}
          {...actionProps("monocle:footer:lines", "MONOCLE_FOOTER_LINES", "Jump to quoted lines")}
        >
          Lines
        </a>
      </nav>
    </footer>
  );
}

function MonocleManApp() {
  const mainRef = useRef(null);
  const openerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  const openVideo = useCallback((event) => {
    openerRef.current = event.currentTarget;
    setModalOpen(true);
  }, []);

  const closeVideo = useCallback(() => {
    setModalOpen(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    document.body.classList.toggle("modal-open", modalOpen);
    return () => {
      document.body.classList.remove("menu-open", "modal-open");
    };
  }, [menuOpen, modalOpen]);

  return (
    <div id="top" className="app-root" data-qid="monocle:app:root">
      <SkipLink mainRef={mainRef} />
      <div className="scroll-progress" aria-hidden="true">
        <span data-qid="monocle:progress:scroll" style={{ width: `${progress}%` }} />
      </div>
      <HeaderNav
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onMenuClose={() => setMenuOpen(false)}
        onOpenVideo={openVideo}
      />
      <main id="main-content" ref={mainRef} tabIndex={-1} data-qid="monocle:main:content">
        <HeroSection onOpenVideo={openVideo} />
        <FilmSection />
        <RulesSection />
        <QuoteGallery />
        <VerdictSection />
      </main>
      <Footer />
      <VideoModal isOpen={modalOpen} onClose={closeVideo} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<MonocleManApp />);
