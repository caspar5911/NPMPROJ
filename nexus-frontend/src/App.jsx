import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [form, setForm] = useState({
    repoUrl: '',
    packageName: '',
    version: '',
  });
  const [status, setStatus] = useState('');
  const [packedTarballs, setPackedTarballs] = useState([]);
  const [allTarballs, setAllTarballs] = useState([]);
  const [selectedTarball, setSelectedTarball] = useState('');
  const [availableVersions, setAvailableVersions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentPackage, setCurrentPackage] = useState('');
  const [uploading, setUploading] = useState(false);

  // New state to hold the selected package.json file before upload
  const [selectedPackageJsonFile, setSelectedPackageJsonFile] = useState(null);

  useEffect(() => {
    fetchAllTarballs();
  }, []);

  const fetchAllTarballs = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/list-tarballs');
      if (!res.ok) throw new Error('Failed to fetch tarballs');
      const data = await res.json();
      setAllTarballs(data.tarballs || []);
    } catch (err) {
      console.error('Error fetching tarballs:', err);
      setAllTarballs([]);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const isValidUrl = (urlString) => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

  const fetchVersions = async () => {
    const pkg = form.packageName.trim();
    if (!pkg) {
      setStatus('Please enter a package name first.');
      return;
    }

    setStatus('Fetching versions...');
    try {
      const res = await fetch(`https://registry.npmjs.org/${pkg}`);
      if (!res.ok) throw new Error('Package not found on NPM');

      const data = await res.json();
      const versions = Object.keys(data.versions).reverse();
      setAvailableVersions(versions);
      setCurrentPackage(pkg);

      setForm((prev) => ({ ...prev, version: '' }));
      setPackedTarballs([]);
      setSelectedTarball('');

      setStatus(`Found ${versions.length} versions.`);
    } catch (err) {
      setAvailableVersions([]);
      setCurrentPackage('');
      setPackedTarballs([]);
      setSelectedTarball('');
      setStatus('Error fetching versions: ' + err.message);
    }
  };

  const handlePackageKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchVersions();
    }
  };

  const handleNpmPack = async (e) => {
    e.preventDefault();

    if (!form.packageName.trim() || !form.version.trim()) {
      setStatus('Package name and version are required.');
      return;
    }

    setStatus('Packing package...');
    try {
      const res = await fetch('http://localhost:4000/api/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: form.packageName.trim(),
          version: form.version.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPackedTarballs((prev) => {
          if (!prev.includes(data.tarballPath)) {
            return [...prev, data.tarballPath];
          }
          return prev;
        });
        await fetchAllTarballs();
        setStatus(`Package packed successfully: ${data.tarballPath}`);
      } else {
        setStatus(`Error packing package: ${data.error}`);
      }
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  };

  const handlePublishTarball = async (e) => {
    e.preventDefault();

    if (!selectedTarball) {
      setStatus('Please select a tarball to publish.');
      return;
    }

    if (!isValidUrl(form.repoUrl)) {
      setStatus('Please enter a valid Nexus repository URL.');
      return;
    }

    setStatus('Publishing tarball to Nexus...');
    try {
      const res = await fetch('http://localhost:4000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarballPath: selectedTarball,
          registryUrl: form.repoUrl.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(`Publish successful: ${data.output}`);
        setPackedTarballs([]);
        setSelectedTarball('');
      } else {
        setStatus(`Publish error: ${data.error}`);
      }
    } catch (err) {
      setStatus('Publish error: ' + err.message);
    }
  };

  const handlePublishAllTarballs = async (e) => {
    e.preventDefault();

    if (!isValidUrl(form.repoUrl)) {
      setStatus('Please enter a valid Nexus repository URL.');
      return;
    }

    setStatus('Publishing all tarballs to Nexus...');

    try {
      const res = await fetch('http://localhost:4000/api/publish-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registryUrl: form.repoUrl.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        const successCount = data.results.filter((r) => r.status === 'success').length;
        const errorCount = data.results.filter((r) => r.status === 'error').length;

        const messages = data.results.map((r) =>
          r.status === 'success' ? `✅ ${r.tarball} — Success` : `❌ ${r.tarball} — Failed: ${r.error}`
        );

        setStatus(
          `Publish All Completed: ${successCount} succeeded, ${errorCount} failed.\n\n` +
            messages.join('\n')
        );

        setPackedTarballs([]);
        setSelectedTarball('');
      } else {
        setStatus(`Publish All error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setStatus('Publish All error: ' + err.message);
    }
  };

  // NEW: Store the file when selected, don't upload yet
  const handlePackageJsonFileSelect = (e) => {
    const file = e.target.files[0];
    setSelectedPackageJsonFile(file);
    setStatus(file ? `Selected file: ${file.name}` : 'No file selected');
  };

  // NEW: Upload the stored package.json file on button click
  const handleUploadPackageJsonClick = async () => {
    if (!selectedPackageJsonFile) {
      setStatus('Please select a package.json file first.');
      return;
    }

    setUploading(true);
    setStatus('Uploading package.json and installing dependencies...');

    const formData = new FormData();
    formData.append('packageJson', selectedPackageJsonFile);

    try {
      const res = await fetch('http://localhost:4000/api/pack-from-packagejson', {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();

      try {
        const data = JSON.parse(text);
        if (res.ok) {
          setStatus(data.message || 'Dependencies installed and packages packed successfully');
          await fetchAllTarballs();
          setSelectedPackageJsonFile(null); // Clear file after upload
        } else {
          setStatus('Upload error: ' + (data.error || 'Unknown error'));
        }
      } catch {
        setStatus('Upload error: Server returned non-JSON response');
        console.error('Response:', text);
      }
    } catch (err) {
      setStatus('Upload error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 600, margin: '1rem auto' }}>
      <h1>NPM Package to Nexus Uploader</h1>
      <form>
        <div style={{ outline: '1px solid #ccc', padding: 16 }}>
          <h2>Generate NPM Packages from a package.json</h2>
          {/* Upload package.json */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>
              Select package.json file:
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handlePackageJsonFileSelect}
              disabled={uploading}
              style={{ width: '68%', padding: 6, marginTop: 4 }}
            />
            <button
              type="button"
              onClick={handleUploadPackageJsonClick}
              disabled={uploading || !selectedPackageJsonFile}
              style={{ marginLeft: 8 }}
            >
              Upload package.json
            </button>
            {uploading && <p style={{ color: 'blue' }}>Uploading and processing...</p>}
          </div>
        </div>
        <div style={{ outline: '1px solid #ccc', padding: 16, }}>
          <h2>Generate Tarball for Specific NPM Package</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: 12}}>
            <label style={{ flex: 1 }}>
              NPM Package Name:
              <input
                type="text"
                name="packageName"
                value={form.packageName}
                onChange={handleChange}
                onKeyDown={handlePackageKeyDown}
                placeholder="e.g. express"
                required
              />
            </label>
            <button type="button" onClick={fetchVersions}>
              Search Versions
            </button>
          </div>
          
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <label>
              NPM Version{currentPackage ? ` (${currentPackage})` : ''}:
              <input
                type="text"
                name="version"
                value={form.version}
                onChange={handleChange}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder={
                  availableVersions.length === 0 ? 'Search or input a package first' : 'Select a version'
                }
                autoComplete="off"
                required
                style={{ width: '97.7%', padding: 6, marginTop: 4, marginBottom: 12 }}
              />
            </label>

            {showDropdown && availableVersions.length > 0 && (
              <ul
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: 150,
                  overflowY: 'auto',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  zIndex: 1000,
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                }}
              >
                {availableVersions
                  .filter((v) => v.includes(form.version.trim()))
                  .map((ver) => (
                    <li
                      key={ver}
                      onMouseDown={() => {
                        setForm({ ...form, version: ver });
                        setShowDropdown(false);
                      }}
                      style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee' }}
                    >
                      {ver}
                    </li>
                  ))}
              </ul>
            )}
            <button onClick={handleNpmPack} type="button" style={{ marginBottom: 16, float: 'right' }}>
              Generate Tarball
            </button>
          </div>
        </div>
        <div style={{ outline: '1px solid #ccc', padding: 16 }}>
          <h2>Upload .tgz Files to Custom NPM Registry</h2>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Nexus Repository URL:
            <input
              type="url"
              name="repoUrl"
              value={form.repoUrl}
              onChange={handleChange}
              placeholder="http://localhost:8081/repository/npm-hosted/"
              required
              style={{ width: '97.7%', padding: 6, marginTop: 4 }}
            />
          </label>

          {allTarballs.length > 0 && (
            <>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Select Tarball to Publish:
                <select
                  value={selectedTarball}
                  onChange={(e) => setSelectedTarball(e.target.value)}
                  style={{ width: '100%', padding: 6, marginTop: 4 }}
                >
                  <option value="">-- Select a tarball --</option>
                  {allTarballs.map((path) => (
                    <option key={path} value={path}>
                      {path.split('/').pop().split('\\').pop()}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: '12px', marginBottom: 16 }}>
                <button onClick={handlePublishTarball} type="button" style={{ flex: 1 }}>
                  Publish Selected Tarball
                </button>
                <button onClick={handlePublishAllTarballs} type="button" style={{ flex: 1 }}>
                  Publish All Tarballs
                </button>
              </div>
            </>
          )}
        </div>
      </form>

      <div style={{ fontWeight: 'bold', whiteSpace: 'pre-wrap', minHeight: '1.5em' }}>{status}</div>

      {packedTarballs.length > 0 && (
        <div>
          <h3>Packed Tarballs This Session:</h3>
          <ul>
            {packedTarballs.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
