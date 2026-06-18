const P_PATH =
  'M6.4,22.2v-0.4c0-0.8,0.2-1.6,0.5-2.3c0.3-0.7,0.8-1.4,1.3-2c0.6-0.6,1.2-1,2-1.3c0.7-0.3,1.5-0.5,2.3-0.5h4.6c1,0,1.9-0.4,2.6-1.1c0.7-0.7,1.1-1.7,1.1-2.6s-0.4-1.9-1.1-2.6c-0.7-0.7-1.7-1.1-2.6-1.1h-6.4v3.7H6.4V4h11.1c2.1,0,4.1,0.8,5.6,2.3c1.5,1.5,2.3,3.5,2.3,5.6c0,2.1-0.8,4.1-2.3,5.6c-1.5,1.5-3.5,2.3-5.6,2.3h-3.1l-1.9-0.1C10.1,19.7,8,20.6,6.4,22.2z'
const FOOT_PATH = 'M10.8,22.4V28H6.4v0c0-2.4,1.5-4.5,3.6-5.4C10.3,22.5,10.5,22.4,10.8,22.4z'

/** The PenguinClip "P" brand mark (stacked blue P with a dark accent foot). */
export function PenguinLogo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PenguinClip logo"
    >
      <path
        fill="#0b1220"
        fillRule="evenodd"
        clipRule="evenodd"
        transform="translate(0.6, 0.6)"
        d={P_PATH}
      />
      <path fill="#1E88E5" fillRule="evenodd" clipRule="evenodd" d={P_PATH} />
      <path fill="#111827" fillRule="evenodd" clipRule="evenodd" d={FOOT_PATH} />
    </svg>
  )
}
