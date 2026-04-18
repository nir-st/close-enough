import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Host from './pages/Host';
import Play from './pages/Play';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/host/:roomCode" element={<Host />} />
        <Route path="/join/:roomCode" element={<Play />} />
        <Route path="/play/:roomCode" element={<Play />} />
      </Routes>
    </Router>
  );
}

export default App;
