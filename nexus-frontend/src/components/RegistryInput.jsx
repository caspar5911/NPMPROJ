import React, { useState } from 'react';

export default function RegistryInput({ registryUrls, setRegistryUrls }) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !registryUrls.includes(trimmed)) {
      setRegistryUrls([...registryUrls, trimmed]);
      setInput('');
    }
  };

  const handleRemove = (index) => {
    const updated = registryUrls.filter((_, i) => i !== index);
    setRegistryUrls(updated);
  };

  return (
    <section style={{ outline: '1px solid #ccc', padding: 16, marginTop: 24, paddingTop: 1 }}>
      <h2>⚙️ Settings</h2>
      <label >
        Registry URLs
        <div className="input-group" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input
            style={{ width: '100%', padding: 6, marginTop: 4 }}
            type="url"
            placeholder="Enter registry URL"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button type="button" onClick={handleAdd} style={{ padding: '6px 12px', width: '20%' }}>
            Add
          </button>
        </div>
      </label>

      {registryUrls.length > 0 && (
        <ul className="registry-list" style={{ display: 'block', width:'100%' ,marginTop: '0.5rem', paddingLeft: '0rem' }}>
          {registryUrls.map((url, index) => (
            <li key={index}>
              <span>{url}</span>
              <button type="button" onClick={() => handleRemove(index)} style={{ padding: '6px 12px', width: '17%' }}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
