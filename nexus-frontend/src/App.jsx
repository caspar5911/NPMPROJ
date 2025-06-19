import { useState, useEffect, useCallback } from 'react';
import {Tabs, TabList, Tab, TabPanel} from 'react-tabs';
import './styles/App.css';
import 'react-tabs/style/react-tabs.css';

import UploadPackageJsonForm from './components/UploadPackageJsonForm';
import GenerateTarballForm from './components/GenerateTarballForm';
import TarballPublisher from './components/TarballPublisher';
import DisplayPackedTarballsMessage from './components/DisplayPackedTarballsMessage';
import RegistryInput from './components/RegistryInput';
import { fetchAllTarballs as fetchTarballsAPI } from './services/api';

function App() {
  const [packedTarballs, setPackedTarballs] = useState([]);
  const [allTarballs, setAllTarballs] = useState([]);
  const [selectedTarball, setSelectedTarball] = useState('');
  const [registryUrls, setRegistryUrls] = useState(['https://registry.npmjs.org/']);

  // useCallback so the function identity is stable for useEffect
  const fetchAllTarballs = useCallback(async () => {
    try {
      const tarballs = await fetchTarballsAPI();
      setAllTarballs(tarballs);
    } catch (err) {
      console.error('Error fetching tarballs:', err);
      setAllTarballs([]);
    }
  }, []);

  useEffect(() => {
    fetchAllTarballs();
  }, [fetchAllTarballs]);

  return (
    <div>
      <Tabs>
        <TabList style={{ display: 'flex', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
          <Tab>NPM</Tab>
          <Tab>NUGET</Tab>
        </TabList>
        <TabPanel>
          <div className="container" style={{
            justifyContent: 'center',
            maxWidth: '1500px',
            width: '100%',
            margin: '2rem auto',
            padding: '1rem',
            gap: '1rem',            // adds horizontal gap between children (better than margin)
          }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>
              NPM Package to Nexus Uploader
            </h1>
            <div style={{display:'flex'}}>
              <div className="section" style={sectionStyle}>
                <h2 style={sectionTitleStyle}>
                  1. Upload <code>package.json</code>
                </h2>
                <UploadPackageJsonForm 
                  fetchAllTarballs={fetchAllTarballs}
                  setPackedTarballs={setPackedTarballs}
                  registryUrls={registryUrls}
                />

                <h2 style={sectionTitleStyle}>2. Generate Tarball</h2>
                <GenerateTarballForm
                  fetchAllTarballs={fetchAllTarballs}
                  setPackedTarballs={setPackedTarballs}
                  setSelectedTarball={setSelectedTarball}
                  registryUrls={registryUrls}
                />
                <RegistryInput
                  registryUrls={registryUrls}
                  setRegistryUrls={setRegistryUrls}
                />
              </div>

              <div className="section" style={sectionStyle}>
                <h2 style={sectionTitleStyle}>3. Publish Tarball</h2>
                <TarballPublisher
                  allTarballs={allTarballs}
                  selectedTarball={selectedTarball}
                  setSelectedTarball={setSelectedTarball}
                />
                <div className="section" style={{ marginTop: '2rem' }}>
                  <DisplayPackedTarballsMessage packedTarballs={packedTarballs} />
                </div>
              </div>
            </div>
          </div>
        </TabPanel>
        <TabPanel>
          {/* NuGet form */}
        </TabPanel>
        </Tabs>
      
    </div>
  );
}

const sectionStyle = {
  padding: '1rem',
  marginBottom: '1.5rem',
  border: '1px solid #ccc',
  borderRadius: '8px',
  backgroundColor: '#f9f9f9',
};

const sectionTitleStyle = {
  fontSize: '1.2rem',
  marginBottom: '1rem',
  color: '#333',
};

export default App;
