// src/App.js  (Home as default landing page)

import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import Home from './pages/Home';
import Gallery from './pages/Gallery';
import People from './pages/People';
import Albums from './pages/Albums';
// import Login from './pages/Login';     // comment out or keep for later

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/people" element={<People />} />
        <Route path="/albums" element={<Albums />} />
        
        {/* Uncomment when ready */}
        {/* <Route path="/login" element={<Login />} /> */}
      </Routes>
    </Router>
  );
}

export default App;