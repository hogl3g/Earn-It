export default function DuckLogo() {
  return (
    <div className="mx-auto mb-6 h-32 w-80 flex items-center justify-center">
      <svg width="320" height="120" viewBox="0 0 320 120" xmlns="http://www.w3.org/2000/svg">
        {/* App name at the top */}
        <text x="160" y="25" fontFamily="Comic Sans MS, cursive" fontSize="28" fontWeight="900" textAnchor="middle" fill="#FF6B35">Earn It!</text>
        
        {/* Yellow background circle */}
        <circle cx="160" cy="75" r="45" fill="#FDE047" stroke="#FACC15" strokeWidth="3"/>
        
        {/* Duck body */}
        <ellipse cx="160" cy="85" rx="25" ry="20" fill="#FFF" stroke="#000" strokeWidth="3"/>
        
        {/* Duck head */}
        <circle cx="160" cy="60" r="18" fill="#FFA500" stroke="#000" strokeWidth="3"/>
        
        {/* Duck bill */}
        <ellipse cx="175" cy="65" rx="8" ry="4" fill="#FFD700" stroke="#000" strokeWidth="2"/>
        
        {/* Duck eyes */}
        <circle cx="155" cy="55" r="4" fill="#FFF" stroke="#000" strokeWidth="2"/>
        <circle cx="155" cy="55" r="2" fill="#000"/>
        <circle cx="156" cy="54" r="1" fill="#FFF"/>
        
        {/* Duck hat/cap */}
        <ellipse cx="160" cy="45" rx="15" ry="8" fill="#60A5FA" stroke="#000" strokeWidth="2"/>
        <rect x="145" y="40" width="30" height="8" rx="4" fill="#60A5FA" stroke="#000" strokeWidth="2"/>
        
        {/* Money stack in one wing */}
        <rect x="125" y="70" width="12" height="15" rx="2" fill="#22C55E" stroke="#000" strokeWidth="2"/>
        <rect x="127" y="68" width="8" height="2" fill="#FFF"/>
        <rect x="127" y="72" width="8" height="2" fill="#FFF"/>
        <rect x="127" y="76" width="8" height="2" fill="#FFF"/>
        <text x="131" y="84" fontFamily="Arial, sans-serif" fontSize="6" fontWeight="900" textAnchor="middle" fill="#000">$</text>
        
        {/* Cleaning supplies in other wing */}
        <rect x="183" y="68" width="15" height="4" rx="2" fill="#6B7280" stroke="#000" strokeWidth="2"/>
        <circle cx="190" cy="70" r="2" fill="#4B5563"/>
        <rect x="198" y="70" width="8" height="12" rx="4" fill="#60A5FA" stroke="#000" strokeWidth="2"/>
        
        {/* Duck feet */}
        <ellipse cx="150" cy="102" rx="6" ry="3" fill="#FFD700" stroke="#000" strokeWidth="2"/>
        <ellipse cx="170" cy="102" rx="6" ry="3" fill="#FFD700" stroke="#000" strokeWidth="2"/>
        
        {/* Wings */}
        <ellipse cx="135" cy="75" rx="10" ry="8" fill="#FFA500" stroke="#000" strokeWidth="2"/>
        <ellipse cx="185" cy="75" rx="10" ry="8" fill="#FFA500" stroke="#000" strokeWidth="2"/>
        
        {/* Excited expression - open beak */}
        <path d="M 175 67 Q 180 69 175 71" stroke="#000" strokeWidth="2" fill="#FF69B4"/>
        
        {/* Action lines showing movement */}
        <path d="M 100 50 L 110 55" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
        <path d="M 105 45 L 115 48" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
        <path d="M 210 50 L 220 55" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
        <path d="M 215 45 L 225 48" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
        
        {/* Dollar signs floating around */}
        <text x="120" y="50" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="900" fill="#22C55E">$</text>
        <text x="200" y="45" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="900" fill="#22C55E">$</text>
        <text x="110" y="90" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="900" fill="#22C55E">$</text>
      </svg>
    </div>
  );
}