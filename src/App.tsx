import { NavLink, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ArticlePage } from './pages/ArticlePage';
import { DashboardPage } from './pages/DashboardPage';
import { IntegrationPage } from './pages/IntegrationPage';

export function App() {
  return (
    <div className="shell">
      <header className="masthead">
        <NavLink to="/" className="brand">
          The Toll Gazette
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Articles
          </NavLink>
          <NavLink to="/dashboard">Earnings</NavLink>
          <NavLink to="/integration">Integration</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/articles/:slug" element={<ArticlePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/integration" element={<IntegrationPage />} />
        <Route path="*" element={<p className="empty">Not found.</p>} />
      </Routes>

      <footer className="footer">
        Humans read free. Agents pay per fetch through TollBit.
      </footer>
    </div>
  );
}
