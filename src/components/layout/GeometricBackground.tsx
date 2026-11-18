export function GeometricBackground() {
  return (
    <div className="pattern-bg" aria-hidden="true">
      <svg className="absolute right-[-8rem] top-[-8rem] h-[34rem] w-[34rem] opacity-[0.13]" viewBox="0 0 400 400">
        <g fill="none" stroke="#F5C451" strokeWidth="1">
          <circle cx="200" cy="200" r="170" />
          <circle cx="200" cy="200" r="120" />
          <path d="M200 30 320 100 320 270 200 340 80 270 80 100Z" />
          <path d="M200 80 275 200 200 320 125 200Z" />
          <path d="M30 200H370M200 30V370M77 77 323 323M323 77 77 323" />
        </g>
      </svg>
      <svg className="absolute bottom-[-10rem] left-[-10rem] h-[38rem] w-[38rem] opacity-[0.1]" viewBox="0 0 400 400">
        <g fill="none" stroke="#14C49A" strokeWidth="1">
          <circle cx="200" cy="200" r="180" />
          <circle cx="200" cy="200" r="130" />
          <circle cx="200" cy="200" r="80" />
          <path d="M200 20 380 200 200 380 20 200Z" />
          <path d="M200 70 330 200 200 330 70 200Z" />
        </g>
      </svg>
    </div>
  );
}
