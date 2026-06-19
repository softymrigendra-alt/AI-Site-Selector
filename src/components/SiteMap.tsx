import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CompetitorStation } from '../lib/externalAPIs';

// Fix Leaflet default icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl'];
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SITE_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:32px;height:32px;border-radius:50%;
    background:#2563EB;border:3px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
    font-size:14px;line-height:1;
  ">⚡</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const COMPETITOR_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:24px;height:24px;border-radius:50%;
    background:#DC2626;border:2px solid white;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);
    display:flex;align-items:center;justify-content:center;
    font-size:11px;line-height:1;
  ">🔌</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Recenter map when coords change
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
}

export interface SiteMapProps {
  lat: number;
  lng: number;
  siteAddress: string;
  competitors?: CompetitorStation[];
  radiusKm?: number;
}

export function SiteMap({ lat, lng, siteAddress, competitors = [], radiusKm = 5 }: SiteMapProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 280 }}>
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapRecenter lat={lat} lng={lng} />

        {/* Analysis radius */}
        <Circle
          center={[lat, lng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.05, weight: 1.5, dashArray: '6 4' }}
        />

        {/* Site pin */}
        <Marker position={[lat, lng]} icon={SITE_ICON}>
          <Popup>
            <strong>📍 Proposed Site</strong><br />
            {siteAddress}
          </Popup>
        </Marker>

        {/* Competitor pins */}
        {competitors.map((c, i) => (
          <Marker key={i} position={[c.lat, c.lng]} icon={COMPETITOR_ICON}>
            <Popup>
              <strong>{c.name}</strong><br />
              {c.network}<br />
              {c.chargerType} · {c.portCount} port(s)<br />
              {c.distanceMiles.toFixed(1)} mi away
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export function SiteMapPlaceholder({ reason }: { reason: string }) {
  return (
    <div
      className="rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm text-center p-6"
      style={{ height: 280 }}
    >
      <div>
        <p className="text-2xl mb-2">🗺️</p>
        <p>Map unavailable</p>
        <p className="text-xs mt-1">{reason}</p>
      </div>
    </div>
  );
}
