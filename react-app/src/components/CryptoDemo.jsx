import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import './CryptoDemo.css'

const steps = [
  { num: '01 / Escolha',    t: 'Dois primos',  d: 'Dois números primos grandes p e q, gerados aleatoriamente.' },
  { num: '02 / Multiplique', t: 'n = p × q',   d: 'O produto vira a base da chave. Público, mas indecifrável.' },
  { num: '03 / Encripte',   t: 'Mensagem',     d: 'Qualquer um pode criptografar usando n.' },
  { num: '04 / Decifre',    t: 'Só você',      d: 'Só quem conhece p e q consegue voltar atrás.' },
]

function useTypewriter(active) {
  const [lines, setLines] = useState({ t1: '', t2: '', t3: '', t4: '' })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))

    const type = async (key, text, speed = 30) => {
      for (let i = 0; i <= text.length; i++) {
        if (cancelled) return
        setLines(prev => ({ ...prev, [key]: text.slice(0, i) }))
        await sleep(speed)
      }
    }

    const run = async () => {
      while (!cancelled) {
        await type('t1', '61'); await sleep(300)
        await type('t2', '53'); await sleep(300)
        await type('t3', '3233'); await sleep(300)
        await type('t4', '0xA7F3 9C2B 41DE 88FF...', 22)
        await sleep(2200)
        if (cancelled) return
        setLines({ t1: '', t2: '', t3: '', t4: '' })
        await sleep(400)
      }
    }
    run()
    return () => { cancelled = true }
  }, [active])

  return lines
}

export default function CryptoDemo() {
  const ref = useRef(null)
  const [active, setActive] = useState(false)
  const lines = useTypewriter(active)

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { setActive(true); obs.disconnect() } })
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section className="crypto" id="como">
      <div className="container">
        <div className="crypto-grid">
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}>
            <span className="kicker">// como funciona</span>
            <h2 className="h2">Multiplicar é fácil.<br/><em>Fatorar é impossível.</em></h2>
            <p className="section-sub">Pegue dois primos enormes, multiplique. Pronto: uma chave pública.
              Para descobrir os primos originais a partir do produto, nem o melhor supercomputador do mundo
              consegue em tempo útil. Esse é o segredo.</p>
            <div className="timeline">
              {steps.map((s, i) => (
                <motion.div key={s.num} className="step"
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}>
                  <div className="step-num">{s.num}</div>
                  <h4>{s.t}</h4>
                  <p>{s.d}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div className="crypto-demo" ref={ref}
            initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, delay: 0.15 }}>
            <div className="crypto-bar"><i /><i /><i className="y" /></div>
            <div className="crypto-line"><span className="label">$</span> <span className="val">gerar_primo p</span></div>
            <div className="crypto-line"><span className="label">→</span> <span className="val">{lines.t1}</span></div>
            <div className="crypto-line"><span className="label">$</span> <span className="val">gerar_primo q</span></div>
            <div className="crypto-line"><span className="label">→</span> <span className="val">{lines.t2}</span></div>
            <div className="crypto-line"><span className="label">$</span> <span className="val">n = p × q</span></div>
            <div className="crypto-line"><span className="label">→</span> <span className="val">{lines.t3}</span></div>
            <div className="crypto-line"><span className="label">$</span> <span className="val">criptografar("OI MUNDO")</span></div>
            <div className="crypto-line"><span className="label">→</span> <span className="secret">{lines.t4}</span></div>
            <div className="crypto-line"><span className="label">$</span> <span className="val">_</span><span className="cursor" /></div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
