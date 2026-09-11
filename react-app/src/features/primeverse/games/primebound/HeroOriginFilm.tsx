import { useEffect, useRef, useState } from 'react'

import { createMusicDirector, startMusicOnFirstGesture } from '../../audio/proceduralMusic'
import { useAudioResource } from '../../audio/useAudioResource'
import { getHeroClass, type HeroClassId } from './heroClassSystem'
import HeroSprite from './HeroSprite'
import { ORIGIN_FILM_TRACKS } from './originFilmMusic'
import {
  HERO_ORIGIN_FILMS,
  originFilmFrame,
  type HeroOriginFilm as HeroOriginFilmDefinition,
  type OriginFilmFrame,
} from './heroOriginFilms'
import {
  createOriginVoicePlayer,
  originBeatAudioPath,
  originQuoteAudioPath,
  readOriginVoiceMuted,
  writeOriginVoiceMuted,
  type OriginVoicePlayer,
} from './originVoice'
import './primebound-origin.css'

/**
 * The origin films: one hand-staged SVG world per champion, filmed with slow
 * camera pushes keyed to the timeline in heroOriginFilms.ts. Every scene has
 * its own palette, composition and animation verbs — a forge is not a city is
 * not a hall of mirrors.
 */

/* ------------------------------------------------------------------ scenes */

function MountainForgeScene(): JSX.Element {
  return (
    <svg className="pbo-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="forge-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b0608" /><stop offset="100%" stopColor="#241009" />
        </linearGradient>
        <radialGradient id="forge-furnace" cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor="#ffb347" /><stop offset="45%" stopColor="#e3541c" />
          <stop offset="100%" stopColor="#3a0f06" />
        </radialGradient>
        <linearGradient id="forge-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4b4652" /><stop offset="100%" stopColor="#211d27" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#forge-sky)" />
      {/* mountain window: cold night outside, the only blue in the room */}
      <g>
        <rect x="90" y="130" width="330" height="420" rx="8" fill="#101b2b" stroke="#3a2c22" strokeWidth="14" />
        <path d="M90 470 L200 330 L265 410 L340 290 L420 430 L420 550 L90 550 Z" fill="#1c2c42" />
        <circle cx="350" cy="200" r="26" fill="#c8d6ea" opacity=".8" />
        <rect x="248" y="130" width="12" height="420" fill="#3a2c22" />
      </g>
      {/* the furnace mouth */}
      <g className="pbof-furnace">
        <rect x="1130" y="240" width="380" height="460" rx="16" fill="#17100e" />
        <ellipse cx="1320" cy="480" rx="150" ry="180" fill="url(#forge-furnace)" />
        <rect x="1130" y="640" width="380" height="60" fill="#241a15" />
      </g>
      {/* sparks that drift up from the coals */}
      <g className="pbof-sparks">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <rect key={index} x={1240 + index * 26} y={560} width="5" height="5" fill="#ffca7a"
            style={{ '--i': index } as React.CSSProperties} className="pbof-spark" />
        ))}
      </g>
      {/* anvil + blade under the hammer */}
      <g className="pbof-anvil">
        <path d="M600 640 L900 640 L870 690 L820 690 L820 740 L680 740 L680 690 L630 690 Z" fill="url(#forge-metal)" />
        <rect x="560" y="740" width="380" height="34" fill="#17131c" />
        {/* the composite blade: visibly welded from parts, it will fail */}
        <g className="pbof-blade-composite">
          <rect x="640" y="616" width="230" height="18" rx="4" fill="#7d7486" />
          <rect x="712" y="612" width="6" height="26" fill="#3b3542" />
          <rect x="784" y="612" width="6" height="26" fill="#3b3542" />
        </g>
        {/* the shatter: same blade, broken at its factor seams */}
        <g className="pbof-blade-shards">
          <rect x="618" y="622" width="80" height="16" rx="4" fill="#7d7486" transform="rotate(-14 658 630)" />
          <rect x="722" y="640" width="66" height="16" rx="4" fill="#6c6377" transform="rotate(9 755 648)" />
          <rect x="806" y="618" width="78" height="16" rx="4" fill="#7d7486" transform="rotate(-6 845 626)" />
        </g>
        {/* the prime blade: one metal, one piece, lit from within */}
        <g className="pbof-blade-prime">
          <rect x="628" y="608" width="252" height="20" rx="6" fill="#f2c15c" />
          <rect x="628" y="614" width="252" height="4" fill="#fff3d2" />
          {['2', '3', '5', '7'].map((rune, index) => (
            <text key={rune} x={676 + index * 52} y="624" fontSize="15" fontFamily="monospace"
              fontWeight="700" fill="#4d3406" textAnchor="middle">{rune}</text>
          ))}
        </g>
      </g>
      {/* Cael himself at the anvil — the same sprite you play, hammer mid-swing */}
      <g className="pbof-smith" transform="translate(952 688)">
        <HeroSprite heroClassId="prime-warrior" x={0} y={0} px={6} facing="left" />
        <g transform="translate(-45 -42)">
          <g className="pbof-hammer-swing">
            <rect x="-64" y="-12" width="64" height="10" rx="4" fill="#3a3243" />
            <rect x="-88" y="-34" width="28" height="32" rx="4" fill="#565061" />
            <rect x="-88" y="-20" width="28" height="6" fill="#6ed7e8" opacity=".5" />
          </g>
        </g>
      </g>
      <g className="pbof-strike-flash"><circle cx="754" cy="626" r="60" fill="#ffe9b0" /></g>
      <rect className="pbo-floorglow" x="0" y="760" width="1600" height="140" fill="#e3541c" opacity=".08" />
    </svg>
  )
}

function CipherCityScene(): JSX.Element {
  const towers = [
    { x: 120, w: 150, h: 420 }, { x: 320, w: 120, h: 540 }, { x: 490, w: 170, h: 360 },
    { x: 710, w: 140, h: 600 }, { x: 900, w: 180, h: 460 }, { x: 1130, w: 130, h: 560 },
    { x: 1310, w: 160, h: 400 },
  ]
  return (
    <svg className="pbo-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="city-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#05060f" /><stop offset="70%" stopColor="#12142e" />
          <stop offset="100%" stopColor="#1c1440" />
        </linearGradient>
        <linearGradient id="city-dawnsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#241436" /><stop offset="100%" stopColor="#7a3b52" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#city-sky)" />
      <rect className="pbc-dawn" width="1600" height="900" fill="url(#city-dawnsky)" />
      {/* the skyline: every tower is a keeper of windows */}
      {towers.map((tower, towerIndex) => (
        <g key={tower.x} transform={`translate(${tower.x} ${880 - tower.h})`}>
          <rect width={tower.w} height={tower.h} fill="#0a0b18" stroke="#232447" strokeWidth="2" />
          {Array.from({ length: Math.floor(tower.h / 62) }, (_, row) => (
            [0, 1, 2].map((col) => (
              <rect key={`${row}-${col}`} className="pbc-window"
                x={16 + col * ((tower.w - 32) / 3) + 4} y={22 + row * 62} width={(tower.w - 44) / 3} height="30"
                fill="#ffd98c" style={{ '--w': (towerIndex * 7 + row * 3 + col) % 11 } as React.CSSProperties} />
            ))
          ))}
        </g>
      ))}
      {/* the old single key, red, hanging over the gate — copied, then everything fell */}
      <g className="pbc-oldkey" transform="translate(800 210)">
        <circle r="34" fill="none" stroke="#ff5d68" strokeWidth="10" />
        <rect x="24" y="-8" width="86" height="16" fill="#ff5d68" />
        <rect x="86" y="4" width="12" height="22" fill="#ff5d68" />
        <rect x="62" y="4" width="12" height="16" fill="#ff5d68" />
      </g>
      <g className="pbc-oldkey-copy" transform="translate(800 210)">
        <circle r="34" fill="none" stroke="#ff5d68" strokeWidth="10" />
        <rect x="24" y="-8" width="86" height="16" fill="#ff5d68" />
      </g>
      {/* Ada's answer: two golden keys and the product hung over the gates */}
      <g className="pbc-twokeys">
        <g transform="translate(700 190) rotate(-16)">
          <circle r="30" fill="none" stroke="#f2c15c" strokeWidth="9" />
          <rect x="22" y="-7" width="76" height="14" fill="#f2c15c" />
          <rect x="76" y="4" width="10" height="20" fill="#f2c15c" />
        </g>
        <g transform="translate(910 190) rotate(16) scale(-1 1)">
          <circle r="30" fill="none" stroke="#8df8f2" strokeWidth="9" />
          <rect x="22" y="-7" width="76" height="14" fill="#8df8f2" />
          <rect x="76" y="4" width="10" height="20" fill="#8df8f2" />
        </g>
        <text x="806" y="110" textAnchor="middle" fontFamily="monospace" fontSize="44" fontWeight="700" fill="#f5edda">
          n = p × q
        </text>
      </g>
      {/* Ada on the wall — her in-game sprite, visor lit, keys orbiting */}
      <g className="pbc-ada" transform="translate(806 736)">
        <rect x="-44" y="60" width="88" height="10" fill="#232447" />
        <HeroSprite heroClassId="rsa-cryptographer" x={0} y={0} px={5} />
      </g>
    </svg>
  )
}

function ResidueSteppeScene(): JSX.Element {
  return (
    <svg className="pbo-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="steppe-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#170f2b" /><stop offset="100%" stopColor="#3d2547" />
        </linearGradient>
        <linearGradient id="steppe-dune" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a2f4f" /><stop offset="100%" stopColor="#241531" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#steppe-sky)" />
      {/* the star wheel: twelve houses, always turning */}
      <g className="pbs-wheel" transform="translate(800 300)">
        <circle r="230" fill="none" stroke="#8d6fb8" strokeWidth="2" opacity=".55" />
        <circle r="160" fill="none" stroke="#8d6fb8" strokeWidth="1.4" opacity=".4" />
        <g className="pbs-wheel-spin">
          {Array.from({ length: 12 }, (_, house) => {
            const angle = (house / 12) * Math.PI * 2 - Math.PI / 2
            return (
              <g key={house} transform={`translate(${Math.cos(angle) * 230} ${Math.sin(angle) * 230})`}>
                <circle r="6" fill={house === 5 ? '#ffd98c' : '#cdb8ea'} />
                <text y="-14" textAnchor="middle" fontFamily="monospace" fontSize="20" fill="#cdb8ea" opacity=".85">
                  {house}
                </text>
              </g>
            )
          })}
        </g>
        <circle className="pbs-house-mark" r="18" fill="none" stroke="#ffd98c" strokeWidth="3" />
      </g>
      {/* dunes rolling to the horizon */}
      <path d="M0 640 Q 380 560 760 645 T 1600 630 L1600 900 L0 900 Z" fill="url(#steppe-dune)" />
      <path d="M0 730 Q 460 660 900 738 T 1600 720 L1600 900 L0 900 Z" fill="#1c1026" />
      {/* the herd: dots that the fog will swallow */}
      <g className="pbs-herd">
        {[260, 320, 395, 455, 540].map((x, index) => (
          <g key={x} transform={`translate(${x} ${700 + (index % 3) * 16})`}>
            <ellipse rx="17" ry="10" fill="#e8ddf2" /><circle cx="15" cy="-5" r="6" fill="#e8ddf2" />
          </g>
        ))}
      </g>
      <rect className="pbs-fog" x="-100" y="600" width="1800" height="200" fill="#b9a8ce" />
      {/* Nara — the huntress sprite from the game, bow strung at her side */}
      <g className="pbs-nara" transform="translate(1150 664)">
        <HeroSprite heroClassId="modular-ranger" x={0} y={0} px={5.5} />
        <path d="M46 -96 Q 80 -44 46 8" fill="none" stroke="#17423f" strokeWidth="7" strokeLinecap="round" />
        <line className="pbs-bowstring" x1="46" y1="-96" x2="46" y2="8" stroke="#cdb8ea" strokeWidth="2" />
      </g>
      {/* the arrow that leaves one edge and returns from the other: mod in flight */}
      <g className="pbs-arrow-flight">
        <path className="pbs-arrow-a" d="M1190 620 Q 1420 520 1660 560" fill="none" stroke="#ffd98c" strokeWidth="4" strokeLinecap="round" />
        <path className="pbs-arrow-b" d="M-60 560 Q 240 470 520 540" fill="none" stroke="#ffd98c" strokeWidth="4" strokeLinecap="round" />
        <text className="pbs-mod-label" x="800" y="852" textAnchor="middle" fontFamily="monospace" fontSize="30" fill="#cdb8ea">
          17 ≡ 5 (mod 12)
        </text>
      </g>
    </svg>
  )
}

function OrganTowerScene(): JSX.Element {
  const pipes = [64, 96, 144, 216, 324, 486]
  return (
    <svg className="pbo-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="organ-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d0a06" /><stop offset="100%" stopColor="#221709" />
        </linearGradient>
        <linearGradient id="organ-brass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6d5324" /><stop offset="45%" stopColor="#c8a24f" />
          <stop offset="55%" stopColor="#e9cf8b" /><stop offset="100%" stopColor="#584318" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#organ-wall)" />
      {/* rose window high in the tower */}
      <g transform="translate(800 150)" opacity=".8">
        <circle r="86" fill="#171126" stroke="#6d5324" strokeWidth="10" />
        {Array.from({ length: 8 }, (_, spoke) => (
          <line key={spoke} x1="0" y1="0"
            x2={Math.cos((spoke / 8) * Math.PI * 2) * 86} y2={Math.sin((spoke / 8) * Math.PI * 2) * 86}
            stroke="#6d5324" strokeWidth="5" />
        ))}
      </g>
      {/* the doubling pipes: 2, 4, 8, 16, 32, 64 — and the rare one, 2^5 − 1 */}
      <g className="pbn-pipes">
        {pipes.map((height, index) => (
          <g key={height} transform={`translate(${360 + index * 120} ${820 - height})`}>
            <rect width="72" height={height} rx="10" fill="url(#organ-brass)"
              className="pbn-pipe" style={{ '--i': index } as React.CSSProperties} />
            <rect width="72" height="16" fill="#3a2c11" rx="6" />
            <text x="36" y={height + 34} textAnchor="middle" fontFamily="monospace" fontSize="24" fill="#c8a24f">
              {2 ** (index + 1)}
            </text>
          </g>
        ))}
        {/* the Mersenne pipe: one semitone short, alive */}
        <g transform="translate(1160 820)">
          <rect className="pbn-mersenne" x="-16" y="-458" width="72" height="458" rx="10" fill="url(#organ-brass)" />
          <text className="pbn-mersenne-label" x="20" y="42" textAnchor="middle" fontFamily="monospace" fontSize="26"
            fontWeight="700" fill="#8df8f2">31</text>
          <text className="pbn-mersenne-label" x="20" y="72" textAnchor="middle" fontFamily="monospace" fontSize="17"
            fill="#8df8f2">2⁵−1</text>
        </g>
      </g>
      {/* chord light washing over the pipes on every bar */}
      <rect className="pbn-chordlight" x="330" y="240" width="920" height="580" fill="#ffdf9e" />
      {/* Noa at the manuals — the arcanist sprite, listening upward */}
      <g className="pbn-noa" transform="translate(800 812)">
        <rect x="-160" y="0" width="320" height="48" rx="8" fill="#171006" />
        <rect x="-120" y="-14" width="240" height="14" fill="#2c2010" />
        <HeroSprite heroClassId="mersenne-arcanist" x={-212} y={-66} px={5.5} />
      </g>
      {/* the lightning the rare voices become */}
      <path className="pbn-bolt" d="M1196 250 L1160 400 L1200 400 L1130 580 L1210 430 L1170 430 L1230 250 Z"
        fill="#8df8f2" />
    </svg>
  )
}

function MirrorHallScene(): JSX.Element {
  const mirrors = [
    { x: 180, label: '6', vanish: false }, { x: 480, label: '12', vanish: true },
    { x: 780, label: '10', vanish: false }, { x: 1080, label: '18', vanish: true },
    { x: 1350, label: '15', vanish: false },
  ]
  return (
    <svg className="pbo-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="hall-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c0a12" /><stop offset="100%" stopColor="#221d33" />
        </linearGradient>
        <linearGradient id="hall-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3c3654" /><stop offset="50%" stopColor="#191527" />
          <stop offset="100%" stopColor="#2e2946" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#hall-wall)" />
      <rect y="760" width="1600" height="140" fill="#141020" />
      <path d="M0 760 L1600 760 L1600 774 L0 774 Z" fill="#3c3654" opacity=".6" />
      {/* the arched mirrors, each judging what it reflects */}
      {mirrors.map((mirror) => (
        <g key={mirror.x} transform={`translate(${mirror.x} 250)`}>
          <path d="M-90 510 L-90 90 Q 0 -60 90 90 L90 510 Z" fill="url(#hall-glass)" stroke="#584d7d" strokeWidth="8" />
          <g className={mirror.vanish ? 'pbm-reflection pbm-reflection--vanishing' : 'pbm-reflection'}>
            <HeroSprite heroClassId="mobius-assassin" x={0} y={396} px={4.2} opacity={0.55} bob={false} />
          </g>
          <text y="60" textAnchor="middle" fontFamily="monospace" fontSize="26" fill="#7d71a5">{mirror.label}</text>
          <text className="pbm-mu" y="560" textAnchor="middle" fontFamily="monospace" fontSize="30" fontWeight="700"
            fill={mirror.vanish ? '#ff5d68' : '#8df8f2'}>
            {mirror.vanish ? 'μ = 0' : 'μ = ±1'}
          </text>
        </g>
      ))}
      {/* Maia herself between the mirrors, sharper than any reflection */}
      <g className="pbm-maia" transform="translate(640 688)">
        <HeroSprite heroClassId="mobius-assassin" x={0} y={0} px={6} />
      </g>
      {/* the möbius ribbon, the hall's crest */}
      <path className="pbm-ribbon" d="M700 120 C 820 40, 960 40, 900 130 C 850 205, 720 205, 760 120 C 800 45, 940 60, 900 130"
        fill="none" stroke="#cbb8f0" strokeWidth="6" opacity=".7" />
    </svg>
  )
}

function FrozenFjordScene(): JSX.Element {
  return (
    <svg className="pbo-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="fjord-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#03070f" /><stop offset="100%" stopColor="#12283c" />
        </linearGradient>
        <linearGradient id="fjord-ice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d7ecf7" /><stop offset="100%" stopColor="#7fb2cf" />
        </linearGradient>
        <linearGradient id="fjord-aurora" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#41e0a0" stopOpacity="0" /><stop offset="45%" stopColor="#41e0a0" stopOpacity=".5" />
          <stop offset="70%" stopColor="#8df8f2" stopOpacity=".4" /><stop offset="100%" stopColor="#41e0a0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#fjord-sky)" />
      <path className="pbg-aurora" d="M0 190 Q 400 90 820 170 T 1600 130 L1600 260 Q 1100 320 700 250 T 0 300 Z"
        fill="url(#fjord-aurora)" />
      {/* black water and the mountains that pin it down */}
      <path d="M0 420 L340 210 L560 400 L830 190 L1080 390 L1340 240 L1600 400 L1600 900 L0 900 Z" fill="#0a1522" />
      <rect y="560" width="1600" height="340" fill="#071019" />
      <path d="M0 560 L1600 560 L1600 574 L0 574 Z" fill="#1d3d54" />
      {/* the dock and its even cargo */}
      <rect x="180" y="620" width="1240" height="40" fill="#22160e" />
      {[260, 420, 1180].map((x) => (
        <rect key={x} x={x} y="520" width="110" height="100" rx="8" fill="url(#fjord-ice)" opacity=".9" />
      ))}
      {/* the block 98, whole — and then its two prime halves */}
      <g transform="translate(700 400)">
        <g className="pbg-block-whole">
          <rect width="240" height="220" rx="12" fill="url(#fjord-ice)" />
          <text x="120" y="130" textAnchor="middle" fontFamily="monospace" fontSize="72" fontWeight="700" fill="#123245">98</text>
        </g>
        <g className="pbg-block-left">
          <rect width="112" height="220" rx="12" fill="url(#fjord-ice)" />
          <text x="56" y="130" textAnchor="middle" fontFamily="monospace" fontSize="52" fontWeight="700" fill="#123245">19</text>
        </g>
        <g className="pbg-block-right">
          <rect x="128" width="112" height="220" rx="12" fill="url(#fjord-ice)" />
          <text x="184" y="130" textAnchor="middle" fontFamily="monospace" fontSize="52" fontWeight="700" fill="#123245">79</text>
        </g>
        <path className="pbg-crack" d="M120 -6 L108 44 L130 96 L112 150 L126 226" fill="none" stroke="#8df8f2" strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* Otto — the berserker sprite, gauntlet arm wound for the second blow */}
      <g className="pbg-otto" transform="translate(520 536)">
        <HeroSprite heroClassId="goldbach-berserker" x={0} y={0} px={7} />
        <g transform="translate(56 -21)">
          <g className="pbg-fist-swing">
            <rect x="0" y="-11" width="78" height="22" rx="10" fill={getHeroClass('goldbach-berserker').palette.primary} />
            <rect x="74" y="-20" width="36" height="36" rx="8" fill={getHeroClass('goldbach-berserker').palette.energy} />
          </g>
        </g>
      </g>
      <text className="pbg-sum-label" x="820" y="330" textAnchor="middle" fontFamily="monospace" fontSize="34"
        fill="#8df8f2">98 = 19 + 79</text>
    </svg>
  )
}

function SieveGreenhouseScene(): JSX.Element {
  const columns = 8
  const rows = 4
  const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31])
  return (
    <svg className="pbo-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="green-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1710" /><stop offset="100%" stopColor="#15281c" />
        </linearGradient>
        <radialGradient id="green-bloom" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#b8f2c5" /><stop offset="100%" stopColor="#39a05b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#green-glass)" />
      {/* the glass roof ribs, moonlight leaking through the panes */}
      <path d="M0 320 L800 60 L1600 320" fill="none" stroke="#2f4f39" strokeWidth="12" />
      {Array.from({ length: 7 }, (_, rib) => (
        <line key={rib} x1={130 + rib * 224} y1={320 - Math.abs(3 - rib) * -1 * 0}
          x2="800" y2="60" stroke="#24402c" strokeWidth="5" opacity=".7" />
      ))}
      <rect y="316" width="1600" height="10" fill="#2f4f39" />
      {/* the planting grid: numbered beds waiting for the sieve */}
      <g className="pbl-grid" transform="translate(224 400)">
        {Array.from({ length: rows }, (_, row) => (
          Array.from({ length: columns }, (_, column) => {
            const value = row * columns + column + 2
            const prime = primes.has(value)
            return (
              <g key={value} transform={`translate(${column * 148} ${row * 112})`}>
                <rect width="120" height="86" rx="10" fill="#0f2015" stroke="#2f4f39" strokeWidth="3" />
                <text x="60" y="54" textAnchor="middle" fontFamily="monospace" fontSize="34" fontWeight="700"
                  fill={prime ? '#b8f2c5' : '#557a5f'} className={prime ? 'pbl-cell-prime' : 'pbl-cell'}>
                  {value}
                </text>
                {prime && <circle className="pbl-bloom" cx="60" cy="42" r="54" fill="url(#green-bloom)" />}
                {!prime && (
                  <line className="pbl-strike" x1="16" y1="70" x2="104" y2="18"
                    stroke="#ff8c5d" strokeWidth="6" strokeLinecap="round"
                    style={{ '--d': (value % 9) } as React.CSSProperties} />
                )}
              </g>
            )
          })
        ))}
      </g>
      {/* Lena — goggles, overalls and sieve backpack, walking the rows */}
      <g className="pbl-lena" transform="translate(150 784)">
        <HeroSprite heroClassId="sieve-engineer" x={0} y={0} px={5.5} />
        <line x1="36" y1="-58" x2="44" y2="66" stroke={getHeroClass('sieve-engineer').palette.secondary} strokeWidth="8" strokeLinecap="round" />
        <rect x="28" y="-76" width="18" height="18" fill="#ff8c5d" />
      </g>
    </svg>
  )
}

function TideObservatoryScene(): JSX.Element {
  const stars: readonly (readonly [number, number, number])[] = [
    [260, 150, 3], [420, 90, 2], [610, 200, 3], [900, 120, 2.6], [1080, 210, 2],
    [1240, 90, 3], [1420, 170, 2.2], [760, 70, 2], [980, 300, 2.4], [1330, 300, 2],
  ]
  return (
    <svg className="pbo-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="tide-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#071019" /><stop offset="72%" stopColor="#12303e" />
          <stop offset="100%" stopColor="#1b4a52" />
        </linearGradient>
        <linearGradient id="tide-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e3a46" /><stop offset="100%" stopColor="#04141c" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#tide-sky)" />
      {stars.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#dff3ef" className="pbi-star" />
      ))}
      {/* the sea, breathing against the cliff */}
      <rect y="560" width="1600" height="340" fill="url(#tide-sea)" />
      <path className="pbi-wave" d="M0 566 Q 200 552 400 566 T 800 566 T 1200 566 T 1600 566" fill="none"
        stroke="#3e8d96" strokeWidth="4" opacity=".7" />
      {/* the cliff and Íris's observatory perch */}
      <path d="M0 900 L0 430 L120 420 L200 480 L290 470 L360 560 L420 620 L440 900 Z" fill="#091820" />
      <rect x="120" y="330" width="120" height="104" rx="10" fill="#0c222c" stroke="#2c5a64" strokeWidth="5" />
      <circle cx="180" cy="368" r="24" fill="#071019" stroke="#3e8d96" strokeWidth="4" />
      {/* the ruler line between two stars, and the third answer */}
      <g className="pbi-tangent">
        <line className="pbi-ruler" x1="610" y1="200" x2="1240" y2="90" stroke="#ffb0c8" strokeWidth="3.5" strokeLinecap="round" />
        <circle className="pbi-third" cx="980" cy="300" r="10" fill="none" stroke="#ffb0c8" strokeWidth="4" />
        <line className="pbi-drop" x1="925" y1="145" x2="980" y2="300" stroke="#ffb0c8" strokeWidth="2.5" strokeDasharray="6 8" />
      </g>
      {/* the hidden curve revealing itself behind the lights */}
      <path className="pbi-curve" d="M420 620 C 640 240, 900 240, 1000 430 C 1080 590, 1260 590, 1460 300"
        fill="none" stroke="#8df8f2" strokeWidth="5" strokeLinecap="round" />
      {/* Íris at the edge — celestial robe, long hair, curve point afloat */}
      <g className="pbi-iris" transform="translate(312 442)">
        <HeroSprite heroClassId="elliptic-oracle" x={0} y={0} px={5} />
      </g>
    </svg>
  )
}

const SCENES: Readonly<Record<HeroOriginFilmDefinition['scene'], () => JSX.Element>> = {
  'mountain-forge': MountainForgeScene,
  'cipher-city': CipherCityScene,
  'residue-steppe': ResidueSteppeScene,
  'organ-tower': OrganTowerScene,
  'mirror-hall': MirrorHallScene,
  'frozen-fjord': FrozenFjordScene,
  'sieve-greenhouse': SieveGreenhouseScene,
  'tide-observatory': TideObservatoryScene,
}

/* --------------------------------------------------------------- component */

export default function HeroOriginFilm({
  heroClassId,
  onFinish,
}: {
  readonly heroClassId: HeroClassId
  readonly onFinish: () => void
}): JSX.Element {
  const filmDefinition = HERO_ORIGIN_FILMS[heroClassId]
  const hero = getHeroClass(heroClassId)
  const [frame, setFrame] = useState<OriginFilmFrame>(() => originFilmFrame(filmDefinition, 0))
  const startedAt = useRef(performance.now())
  const done = useRef(false)
  const [voiceMuted, setVoiceMuted] = useState(readOriginVoiceMuted)
  const getMusic = useAudioResource(() => createMusicDirector(ORIGIN_FILM_TRACKS[filmDefinition.scene]))
  const staticScoreRef = useRef<HTMLAudioElement | null>(null)
  const usingStaticScore = useRef(false)

  // A hand-picked score dropped at public/games/primebound/origins/
  // score-<scene>.mp3 wins; the procedural engine is the always-on fallback.
  useEffect(() => {
    const score = new Audio(`/games/primebound/origins/score-${filmDefinition.scene}.mp3`)
    staticScoreRef.current = score
    score.loop = true
    score.volume = 0.32
    let cancelGesture: (() => void) | undefined
    const startProcedural = () => {
      if (usingStaticScore.current) return
      void getMusic().start()
      cancelGesture = startMusicOnFirstGesture(getMusic())
    }
    score.addEventListener('canplaythrough', () => {
      usingStaticScore.current = true
      getMusic().stop()
    }, { once: true })
    score.addEventListener('error', startProcedural, { once: true })
    score.play().catch(() => {
      if (!usingStaticScore.current) startProcedural()
    })
    return () => {
      cancelGesture?.()
      getMusic().stop()
      score.pause()
      score.src = ''
      staticScoreRef.current = null
      usingStaticScore.current = false
    }
  }, [filmDefinition.scene, getMusic])

  // The score swells with the film: procedural via intensity, static via volume.
  useEffect(() => {
    getMusic().setIntensity(Math.min(0.9, 0.25 + frame.progress * 0.65))
    if (staticScoreRef.current && usingStaticScore.current) {
      staticScoreRef.current.volume = Math.min(0.5, 0.24 + frame.progress * 0.26)
    }
  }, [frame.progress, getMusic])
  const voiceRef = useRef<OriginVoicePlayer | null>(null)
  const getVoice = () => {
    voiceRef.current ??= createOriginVoicePlayer()
    return voiceRef.current
  }

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const next = originFilmFrame(filmDefinition, performance.now() - startedAt.current)
      setFrame(next)
      if (next.finished && !done.current) {
        done.current = true
        onFinish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      if (done.current) return
      done.current = true
      onFinish()
    }
    window.addEventListener('keydown', skip)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', skip)
    }
  }, [filmDefinition, onFinish])

  const Scene = SCENES[filmDefinition.scene]
  const lastBeat = frame.beatIndex === filmDefinition.beats.length - 1
  const showTitleCard = lastBeat && frame.beatProgress > 0.45

  useEffect(() => () => voiceRef.current?.stop(), [])
  useEffect(() => {
    if (voiceMuted) voiceRef.current?.stop()
  }, [voiceMuted])

  // The narrator reads every beat; over the title card the hero's line queues
  // up right after the narration instead of cutting it off.
  const beatId = frame.beat.id
  useEffect(() => {
    if (voiceMuted) return
    getVoice().play(originBeatAudioPath(beatId), filmDefinition.beats.find((beat) => beat.id === beatId)?.caption ?? '', { kind: 'narrator' })
  }, [beatId, filmDefinition, voiceMuted])

  useEffect(() => {
    if (!showTitleCard || voiceMuted) return
    getVoice().playNext(originQuoteAudioPath(heroClassId), filmDefinition.quote, {
      kind: 'hero',
      gender: hero.gender,
    })
  }, [filmDefinition, hero.gender, heroClassId, showTitleCard, voiceMuted])

  return (
    <section
      className={`pbo-film pbo-film--${filmDefinition.scene}`}
      data-shot={frame.beat.id}
      style={{
        '--bp': frame.beatProgress,
        '--accent': hero.palette.accent,
        '--energy': hero.palette.energy,
      } as React.CSSProperties}
      aria-label={`Origem de ${hero.characterName}, ${hero.title}`}
    >
      <div className="pbo-stage" data-shot={frame.beat.id}>
        <Scene />
      </div>
      <div className="pbo-grain" aria-hidden="true" />
      <i className="pbo-bar pbo-bar--top" aria-hidden="true" />
      <i className="pbo-bar pbo-bar--bottom" aria-hidden="true" />

      {frame.beatIndex === 0 && frame.beatProgress < 0.55 && (
        <p className="pbo-epigraph" aria-hidden="true">{filmDefinition.epigraph}</p>
      )}

      <div className="pbo-caption" role="status" aria-live="polite" aria-atomic="true">
        <p key={frame.beat.id}>{frame.beat.caption}</p>
        <div className="pbo-caption__dots" aria-hidden="true">
          {filmDefinition.beats.map((beat, index) => (
            <i key={beat.id} className={index <= frame.beatIndex ? 'is-lit' : undefined} />
          ))}
        </div>
      </div>

      {showTitleCard && (
        <div className="pbo-titlecard" aria-hidden="true">
          <small>{hero.affinity.name}</small>
          <strong>{hero.characterName}</strong>
          <em>{hero.title}</em>
          <p>“{filmDefinition.quote}”</p>
        </div>
      )}

      <button
        type="button"
        className="pbo-voice"
        aria-pressed={voiceMuted}
        onClick={() => {
          setVoiceMuted((current) => {
            writeOriginVoiceMuted(!current)
            return !current
          })
        }}
      >
        {voiceMuted ? '🔇 VOZ DESLIGADA' : '🔊 VOZ LIGADA'}
      </button>
      <button
        type="button"
        className="pbo-skip"
        onClick={() => {
          if (done.current) return
          done.current = true
          onFinish()
        }}
      >
        <kbd>ESPAÇO</kbd> PULAR FILME
      </button>
    </section>
  )
}
