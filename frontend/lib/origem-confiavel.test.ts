import { describe, it, expect } from 'vitest'
import { origemConfiavel } from './origem-confiavel'

describe('origemConfiavel', () => {
  it('usa NEXT_PUBLIC_SITE_URL quando definida, em qualquer ambiente', () => {
    const env = { NEXT_PUBLIC_SITE_URL: 'https://impacto.exemplo.com', NODE_ENV: 'production' }
    expect(origemConfiavel('https://host-falso.exemplo', env)).toBe('https://impacto.exemplo.com')
  })

  it('em produção sem NEXT_PUBLIC_SITE_URL não aceita o header Host (retorna null)', () => {
    const env = { NODE_ENV: 'production' }
    expect(origemConfiavel('https://host-falso.exemplo', env)).toBeNull()
  })

  it('fora de produção cai para a origem da requisição (dev local)', () => {
    expect(origemConfiavel('http://localhost:3000', { NODE_ENV: 'development' })).toBe('http://localhost:3000')
  })
})
