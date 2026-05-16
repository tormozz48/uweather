import { Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage.js';
import { SharedForecastPage } from './pages/SharedForecastPage.js';

/**
 * App — top-level route switch.
 *
 * Routes:
 *   /                         — home (search + pipeline + history)
 *   /forecast/:forecastId     — public shared forecast view
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/forecast/:forecastId" element={<SharedForecastPage />} />
    </Routes>
  );
}
