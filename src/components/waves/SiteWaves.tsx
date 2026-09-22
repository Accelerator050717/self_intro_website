import { useEffect, useState } from 'react';
import GradientWaves from './GradientWaves';

export default function SiteWaves() {
  const [dark, setDark] = useState(() => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark');
  useEffect(() => {
    const theme = () => setDark(document.documentElement.dataset.theme === 'dark');
    theme(); window.addEventListener('ice-theme-change', theme);
    return () => window.removeEventListener('ice-theme-change', theme);
  }, []);
  return <GradientWaves
    horizonColor={dark ? '#126a95' : '#27cbff'}
    waveColor={dark ? '#174d70' : '#9fe3ff'}
    crestColor={dark ? '#328b9e' : '#9de4e2'}
    speed={0.4} amplitude={2.5} waveScale={0.6} waveRatio={0.9}
    swell={35} turbulence={20} tilt={1.11} zoom={1.0} height={5.5}
    fogDepth={15} detail="medium" brightness={1.0} opacity={1.0}
    mouseInteraction={true} parallaxStrength={0.5} grain={true} grainIntensity={0.05}
  />;
}
