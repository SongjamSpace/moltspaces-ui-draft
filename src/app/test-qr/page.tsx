'use client';

import { useState } from 'react';
import { generateQRWithLogo } from '@/services/qr.service';

export default function TestQRPage() {
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('testuser');
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(1000);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const data = `https://my.songjam.space/${username}`;
      const logoUrl = '/black_logo.png';
      
      const blob = await generateQRWithLogo(data, logoUrl, { width, height });
      const objectUrl = URL.createObjectURL(blob);
      setQrBlobUrl(objectUrl);
    } catch (error) {
      console.error('Error generating QR:', error);
      alert('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 flex flex-col items-center gap-6 bg-black min-h-screen text-white">
      <h1 className="text-2xl font-bold">QR Code Test</h1>
      
      <div className="flex flex-col gap-4 items-center">
        <div className="flex gap-2">
            <label>Username:</label>
            <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="p-2 rounded bg-gray-800 border border-gray-700"
            />
        </div>
        <div className="flex gap-4">
            <div className="flex gap-2 items-center">
                <label>Width:</label>
                <input 
                    type="number" 
                    value={width} 
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="p-2 w-24 rounded bg-gray-800 border border-gray-700"
                />
            </div>
            <div className="flex gap-2 items-center">
                <label>Height:</label>
                <input 
                    type="number" 
                    value={height} 
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="p-2 w-24 rounded bg-gray-800 border border-gray-700"
                />
            </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={loading}
          className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-500 disabled:opacity-50 mt-2"
        >
          {loading ? 'Generating...' : 'Generate QR'}
        </button>
      </div>

      {qrBlobUrl && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-400">Generated QR Code:</p>
          <img src={qrBlobUrl} alt="Generated QR" className="border-4 border-white rounded-lg" style={{ maxWidth: '100%', maxHeight: '600px' }} />
          <p className="text-sm text-gray-500">Scan this to verify it points to: https://my.songjam.space/{username}</p>
        </div>
      )}
    </div>
  );
}
