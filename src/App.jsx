import { useState } from 'react';
import './App.css';
import FusionTab from './components/FusionTab';
import ProcessingTab from './components/ProcessingTab';

function App() {
  // 탭 상태만 관리
  const [activeTab, setActiveTab] = useState('fusion'); // 'fusion', 'processing'

  return (
    <div className="App">
      <h1>젬 가공 시뮬레이터</h1><h4>by 조알기@아브렐슈드</h4>
      <div className="version-info">v2025.09.11 11:50</div>
      
      {/* 탭 네비게이션 */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'fusion' ? 'active' : ''}`}
          onClick={() => setActiveTab('fusion')}
        >
          🔮 융합
        </button>
        <button 
          className={`tab-button ${activeTab === 'processing' ? 'active' : ''}`}
          onClick={() => setActiveTab('processing')}
        >
          ⚙️ 가공
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