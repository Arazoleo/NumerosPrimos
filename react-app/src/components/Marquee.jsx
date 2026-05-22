import './Marquee.css'

const SET = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97]

export default function Marquee() {
  const row = (
    <span>
      {SET.map((p, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 56 }}>
          {p}<i className="sep" />
        </span>
      ))}
    </span>
  )
  return (
    <div className="marquee">
      <div className="marquee-track">
        {row}{row}
      </div>
    </div>
  )
}
