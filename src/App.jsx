import { useState } from 'react';
import './App.css';
import FusionTab from './components/FusionTab';
import ProcessingTab from './components/ProcessingTab';

function App() {
  // 탭 상태만 관리
  const [activeTab, setActiveTab] = useState('fusion'); // 'fusion' or 'processing'

  return (
    <div className="App">
      <h1>🎮 로스트아크 젬 시뮬레이터</h1>
      <div className="version-info">v2025.08.28 14:46</div>
      
      {/* 탭 네비게이션 */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'fusion' ? 'active' : ''}`}
          onClick={() => setActiveTab('fusion')}
        >
          🔮 젬 융합
        </button>
        <button 
          className={`tab-button ${activeTab === 'processing' ? 'active' : ''}`}
          onClick={() => setActiveTab('processing')}
        >
          ⚙️ 젬 가공
        </button>
      </div>

      {/* 탭 내용 */}
      {activeTab === 'fusion' && (
        <FusionTab />
      )}
      
      {activeTab === 'processing' && (
        <ProcessingTab />
      )}
    </div>
  );
}

export default App;