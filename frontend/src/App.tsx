import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { ScrollToTop } from "./components/ScrollToTop";
import { About } from "./pages/About";
import { Grader } from "./pages/Grader";

function Shell() {
  const location = useLocation();
  const compactHeader = location.pathname !== "/";

  return (
    <div className="paper-grain relative min-h-screen text-ink">
      <ScrollToTop />
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-10 sm:px-10">
        <Header compact={compactHeader} />
        <Routes>
          <Route path="/" element={<Grader />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mt-16 max-w-xl animate-fade-in-up">
      <p className="eyebrow">404</p>
      <h2 className="font-display text-display-lg mt-3">Not in this issue.</h2>
      <p className="mt-4 font-sans text-base text-ink2">
        That page doesn't exist. Head back to the upload page.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
