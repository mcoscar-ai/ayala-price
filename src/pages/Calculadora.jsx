import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { Plus, Trash2, FileText, Lock, Settings, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { LOGO_DATA_URL, LOGO_BASE64 } from '../lib/constants'

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}

const TIPOS = [
  { value: 'servico', label: 'Serviço (tempo)' },
  { value: 'procedimento', label: 'Procedimento (tempo+material)' },
  { value: 'produto', label: 'Produto (custo direto)' },
]

const MODALIDADES_BASE = [
  { value: 'pix', label: 'Pix' },
  { value: 'especie', label: 'Espécie' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito_1x', label: 'Créd. 1x' },
  { value: 'credito_2x', label: 'Créd. 2x' },
  { value: 'credito_3x', label: 'Créd. 3x' },
  { value: 'credito_4x', label: 'Créd. 4x' },
  { value: 'credito_5x', label: 'Créd. 5x' },
  { value: 'credito_6x', label: 'Créd. 6x' },
  { value: 'credito_7x', label: 'Créd. 7x' },
  { value: 'credito_8x', label: 'Créd. 8x' },
  { value: 'credito_9x', label: 'Créd. 9x' },
  { value: 'credito_10x', label: 'Créd. 10x' },
]

const DEFAULT_CONFIG = {
  meta_faturamento: '30000', horas_dia: '2.5', dias_mes: '22', pro_labore: '8000',
  custo_fixo_mensal: '0', atendimentos_mes: '55', imposto_percentual: '17',
  desconto_especie: '10', taxa_debito: '1.5',
  taxa_credito_1x: '2.0', taxa_credito_2x: '2.5', taxa_credito_3x: '3.0', taxa_credito_4x: '3.5',
  taxa_credito_5x: '4.0', taxa_credito_6x: '4.5', taxa_credito_7x: '5.0', taxa_credito_8x: '5.5',
  taxa_credito_9x: '6.0', taxa_credito_10x: '6.5',
  nome_medico: 'Dr. Oscar Misael Ayala Pizana',
  especialidade: 'Clínico Geral Esp. Medicina de Família e Comunidade',
  crm: 'CRM-SC 25531', rqe: 'RQE 21185',
  endereco: 'Rua Alfredo João Krieck, 291 — Sala 12, Gravatá, Navegantes/SC',
  telefone: '(47) 99254-6849',
}

function novaLinha() {
  return { id: Math.random().toString(36).slice(2), nome: '', tipo: 'servico', duracao_min: '', custo_unit: '', qtd: '1', margem: '' }
}

export default function Calculadora() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [showConfig, setShowConfig] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [linhas, setLinhas] = useState([novaLinha()])
  const [modalidade, setModalidade] = useState('credito_1x')
  const [pacienteNome, setPacienteNome] = useState('')
  const [pacienteIdade, setPacienteIdade] = useState('')
  const [formasPagamento, setFormasPagamento] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    supabase.from('configuracoes').select('*').then(({ data }) => {
      if (data && data.length) {
        const map = { ...DEFAULT_CONFIG }
        data.forEach(({ chave, valor }) => { if (valor) map[chave] = valor })
        setConfig(map)
      }
      setLoadingConfig(false)
    }).catch(() => setLoadingConfig(false))
  }, [])

  async function salvarConfig() {
    const upserts = Object.entries(config).map(([chave, valor]) => ({ chave, valor: String(valor) }))
    await supabase.from('configuracoes').upsert(upserts, { onConflict: 'chave' })
    toast.success('Configuração salva')
    setShowConfig(false)
  }

  function setC(k, v) { setConfig(c => ({ ...c, [k]: v })) }

  const horasDia = Number(config.horas_dia) || 2.5
  const diasMes = Number(config.dias_mes) || 22
  const proLabore = Number(config.pro_labore) || 8000
  const custoFixoMensal = Number(config.custo_fixo_mensal) || 0
  const atendMes = Number(config.atendimentos_mes) || 55
  const totalHorasMes = horasDia * diasMes
  const custoHoraProLabore = totalHorasMes > 0 ? proLabore / totalHorasMes : 0
  const custoFixoAtend = atendMes > 0 ? custoFixoMensal / atendMes : 0
  const imposto = Number(config.imposto_percentual) || 17

  const modalidades = MODALIDADES_BASE.map(m => {
    if (m.value === 'pix') return { ...m, taxa: 0 }
    if (m.value === 'especie') return { ...m, taxa: 0, desconto: Number(config.desconto_especie) || 0 }
    if (m.value === 'debito') return { ...m, taxa: Number(config.taxa_debito) || 0 }
    const parcela = m.value.split('_')[1]
    return { ...m, taxa: Number(config['taxa_credito_' + parcela]) || 0 }
  })
  const modAtual = modalidades.find(m => m.value === modalidade) || modalidades[3]

  function calcLinha(linha) {
    const dur = (Number(linha.duracao_min) || 0) / 60
    const custoUnit = Number(linha.custo_unit) || 0
    const qtd = Number(linha.qtd) || 1
    let custoUnitario = 0
    if (linha.tipo === 'servico') custoUnitario = dur * custoHoraProLabore + custoFixoAtend
    else if (linha.tipo === 'procedimento') custoUnitario = dur * custoHoraProLabore + custoUnit + custoFixoAtend
    else custoUnitario = custoUnit + custoFixoAtend

    const custoTotal = custoUnitario * qtd
    const margemPadrao = linha.tipo === 'servico' ? 50 : linha.tipo === 'procedimento' ? 60 : 35
    const margem = linha.margem !== '' ? Number(linha.margem) : margemPadrao
    const precoBase = margem >= 100 ? custoTotal * 2 : custoTotal / (1 - margem / 100)
    const precoComImposto = precoBase / (1 - imposto / 100)
    let precoFinal
    if (modAtual.value === 'especie') precoFinal = precoComImposto * (1 - (modAtual.desconto || 0) / 100)
    else if (modAtual.taxa > 0) precoFinal = precoComImposto / (1 - modAtual.taxa / 100)
    else precoFinal = precoComImposto

    const impostoValor = precoFinal * imposto / 100
    const taxaValor = modAtual.value === 'especie' ? 0 : precoFinal * (modAtual.taxa || 0) / 100
    const lucro = precoFinal - custoTotal - impostoValor - taxaValor
    const margemLiquida = precoFinal > 0 ? (lucro / precoFinal) * 100 : 0

    return { custoUnitario, custoTotal, margem, precoFinal, lucro, margemLiquida }
  }

  function semaforo(m) { if (m >= 30) return '🟢'; if (m >= 15) return '🟡'; return '🔴' }

  function updateLinha(id, key, val) { setLinhas(prev => prev.map(l => l.id === id ? { ...l, [key]: val } : l)) }
  function addLinha() { setLinhas(prev => [...prev, novaLinha()]) }
  function removeLinha(id) { setLinhas(prev => prev.filter(l => l.id !== id)) }

  const linhasCalc = linhas.map(l => ({ ...l, calc: calcLinha(l) }))
  const totalCusto = linhasCalc.reduce((s, l) => s + (l.nome ? l.calc.custoTotal : 0), 0)
  const totalPreco = linhasCalc.reduce((s, l) => s + (l.nome ? l.calc.precoFinal : 0), 0)
  const totalLucro = linhasCalc.reduce((s, l) => s + (l.nome ? l.calc.lucro : 0), 0)
  const margemGeral = totalPreco > 0 ? (totalLucro / totalPreco) * 100 : 0

  function buildPDF(interno) {
    const validas = linhasCalc.filter(l => l.nome)
    if (validas.length === 0) return toast.error('Adicione ao menos um item')

    const pdf = new jsPDF({ format: 'a4', unit: 'mm' })
    const w = pdf.internal.pageSize.getWidth()
    const M = 14
    let y = M

    if (interno) {
      pdf.saveGraphicsState()
      pdf.setTextColor(192, 57, 43); pdf.setFontSize(22); pdf.setFont('helvetica', 'bold')
      const gs = new pdf.GState({ opacity: 0.12 }); pdf.setGState(gs)
      const ph = pdf.internal.pageSize.getHeight()
      for (let yy = 20; yy < ph + 60; yy += 35)
        for (let x = -30; x < w + 60; x += 90) pdf.text('USO INTERNO', x, yy, { angle: 45 })
      pdf.restoreGraphicsState()
      pdf.setFillColor(192, 57, 43); pdf.rect(0, 0, w, 16, 'F')
      pdf.setTextColor(255,255,255); pdf.setFontSize(9); pdf.setFont('helvetica','bold')
      pdf.text('USO INTERNO — CONFIDENCIAL', M, 7)
      pdf.text('NAO COMPARTILHAR COM PACIENTES', M, 12)
      y = 22
    }

    try { pdf.addImage('data:image/png;base64,' + LOGO_BASE64, 'PNG', M, y, 70, 23) } catch(e) {}
    pdf.setTextColor(31,73,125); pdf.setFontSize(11); pdf.setFont('helvetica','bold')
    pdf.text(config.nome_medico, w - M, y + 5, { align: 'right' })
    pdf.setFontSize(8.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(85,85,85)
    pdf.text(config.especialidade, w - M, y + 11, { align: 'right' })
    pdf.text(config.crm + '  |  ' + config.rqe, w - M, y + 17, { align: 'right' })
    y += 30
    pdf.setDrawColor(31,73,125); pdf.setLineWidth(0.5); pdf.line(M, y, w - M, y); y += 5

    if (pacienteNome || pacienteIdade) {
      pdf.setFillColor(244,246,249); pdf.rect(M, y, w - M*2, 9, 'F')
      pdf.setTextColor(31,73,125); pdf.setFontSize(9); pdf.setFont('helvetica','bold')
      pdf.text('Paciente:', M+3, y+6)
      pdf.setFont('helvetica','normal'); pdf.setTextColor(85,85,85)
      pdf.text(pacienteNome || '', M+22, y+6)
      if (pacienteIdade) {
        pdf.setFont('helvetica','bold'); pdf.setTextColor(31,73,125)
        pdf.text('Idade:', w/2, y+6)
        pdf.setFont('helvetica','normal'); pdf.setTextColor(85,85,85)
        pdf.text(pacienteIdade + ' anos', w/2+14, y+6)
      }
      y += 13
    }

    pdf.setFillColor(31,73,125); pdf.rect(M, y, w - M*2, 10, 'F')
    pdf.setTextColor(255,255,255); pdf.setFontSize(10); pdf.setFont('helvetica','bold')
    pdf.text('ORCAMENTO', M+3, y+6.5); y += 14

    const head = interno ? [['Item','Qtd','Custo','Preco']] : [['Item','Qtd','Valor']]
    const body = validas.map(l => interno
      ? [l.nome, l.qtd || '1', formatBRL(l.calc.custoTotal), formatBRL(l.calc.precoFinal)]
      : [l.nome, l.qtd || '1', formatBRL(l.calc.precoFinal)]
    )
    pdf.autoTable({ startY: y, head, body, styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [31,73,125], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244,246,249] }, margin: { left: M, right: M } })
    y = pdf.lastAutoTable.finalY + 6

    pdf.setFillColor(244,246,249); pdf.rect(M, y, w - M*2, 18, 'F')
    pdf.setDrawColor(31,73,125); pdf.setLineWidth(0.3); pdf.rect(M, y, w - M*2, 18)
    pdf.setTextColor(31,73,125); pdf.setFontSize(9); pdf.setFont('helvetica','bold')
    pdf.text('TOTAL', M+4, y+7)
    pdf.setFontSize(13); pdf.text(formatBRL(totalPreco), M+4, y+14)
    y += 23

    if (formasPagamento) {
      pdf.setTextColor(85,85,85); pdf.setFontSize(8); pdf.setFont('helvetica','normal')
      const l1 = pdf.splitTextToSize(formasPagamento, w - M*2)
      pdf.text(l1, M, y); y += l1.length*4.5+3
    }
    if (observacoes) {
      pdf.setTextColor(100,100,100); pdf.setFontSize(8); pdf.setFont('helvetica','italic')
      const l2 = pdf.splitTextToSize(observacoes, w - M*2)
      pdf.text(l2, M, y); y += l2.length*4.5+3
    }

    if (interno) {
      y += 4
      const boxH = 36
      pdf.setFillColor(240,240,240); pdf.rect(M, y, w - M*2, boxH, 'F')
      pdf.setDrawColor(192,57,43); pdf.setLineWidth(1.5); pdf.line(M, y, M, y+boxH)
      pdf.setLineWidth(0.3); pdf.setDrawColor(220,220,220); pdf.rect(M, y, w - M*2, boxH)
      pdf.setTextColor(192,57,43); pdf.setFontSize(9); pdf.setFont('helvetica','bold')
      pdf.text('GESTAO FINANCEIRA — CONFIDENCIAL', M+5, y+8)
      pdf.setTextColor(60,60,60); pdf.setFontSize(8); pdf.setFont('helvetica','normal')
      const mid = (w - M*2)/2
      pdf.text('Custo total: ' + formatBRL(totalCusto), M+5, y+16)
      pdf.text('Modalidade: ' + modAtual.label, M+mid+5, y+16)
      pdf.text('Preco total: ' + formatBRL(totalPreco), M+5, y+23)
      pdf.text('Lucro liquido: ' + formatBRL(totalLucro), M+mid+5, y+23)
      pdf.text('Margem liquida: ' + margemGeral.toFixed(1) + '%', M+5, y+30)
    }

    const pageH = pdf.internal.pageSize.getHeight()
    if (interno) {
      pdf.setDrawColor(192,57,43); pdf.setLineWidth(0.3); pdf.line(M, pageH-12, w-M, pageH-12)
      pdf.setTextColor(192,57,43); pdf.setFontSize(7.5); pdf.setFont('helvetica','bold')
      pdf.text('USO INTERNO | Clinica Ayala | Nao distribuir', M, pageH-7)
    } else {
      pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.3); pdf.line(M, pageH-12, w-M, pageH-12)
      pdf.setTextColor(120,120,120); pdf.setFontSize(7.5); pdf.setFont('helvetica','normal')
      pdf.text((config.endereco||'') + '  |  ' + (config.telefone||''), M, pageH-7)
      pdf.text('Emitido em: ' + new Date().toLocaleDateString('pt-BR'), w-M, pageH-7, { align:'right' })
    }

    pdf.save((interno ? 'INTERNO_' : '') + 'Orcamento.pdf')
  }

  if (loadingConfig) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="bg-primary text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-40 shadow-md">
        <div className="bg-white rounded-lg px-2 py-1 flex items-center" style={{ height: 40 }}>
          <img src={LOGO_DATA_URL} alt="Clínica Ayala" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
        </div>
        <span className="text-sm font-medium text-blue-200 hidden sm:inline">Ayala Price</span>
        <button onClick={() => setShowConfig(true)} className="ml-auto flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
          <Settings size={15} /> <span className="hidden sm:inline">Configurações</span>
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="bg-white rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-gray-500">Sua hora</p>
            <p className="text-base font-semibold text-primary">{formatBRL(custoHoraProLabore)}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-gray-500">Custo fixo/atend.</p>
            <p className="text-base font-semibold text-primary">{formatBRL(custoFixoAtend)}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-gray-500">Imposto</p>
            <p className="text-base font-semibold text-primary">{imposto}%</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-gray-500">Modalidade</p>
            <select value={modalidade} onChange={e => setModalidade(e.target.value)}
              className="text-sm font-semibold text-primary bg-transparent outline-none w-full">
              {modalidades.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="space-y-3">
            {linhasCalc.map((l) => (
              <div key={l.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className="flex gap-2 mb-2">
                  <input
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Nome do item (ex: Consulta, Tirzepatida 60mg)"
                    value={l.nome}
                    onChange={e => updateLinha(l.id, 'nome', e.target.value)}
                  />
                  <button onClick={() => removeLinha(l.id)} className="text-gray-400 hover:text-danger px-2">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <select value={l.tipo} onChange={e => updateLinha(l.id, 'tipo', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white outline-none">
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {(l.tipo === 'servico' || l.tipo === 'procedimento') && (
                    <input type="number" placeholder="Minutos" value={l.duracao_min}
                      onChange={e => updateLinha(l.id, 'duracao_min', e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none" />
                  )}
                  {(l.tipo === 'procedimento' || l.tipo === 'produto') && (
                    <input type="number" placeholder="Custo R$" value={l.custo_unit}
                      onChange={e => updateLinha(l.id, 'custo_unit', e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none" />
                  )}
                  <input type="number" placeholder="Qtd" value={l.qtd}
                    onChange={e => updateLinha(l.id, 'qtd', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none" />
                  <input type="number" placeholder={'Margem % (' + (l.tipo==='servico'?50:l.tipo==='procedimento'?60:35) + ')'} value={l.margem}
                    onChange={e => updateLinha(l.id, 'margem', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none" />
                  <div className="flex items-center justify-end gap-1 px-1">
                    <span className="text-xs">{semaforo(l.calc.margemLiquida)}</span>
                    <span className="text-sm font-semibold text-primary">{formatBRL(l.calc.precoFinal)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addLinha} className="mt-3 flex items-center gap-2 text-sm text-primary font-medium hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Adicionar item
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Custo total</span>
            <span className="text-sm font-medium text-gray-700">{formatBRL(totalCusto)}</span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Lucro líquido estimado</span>
            <span className="text-sm font-medium text-success">{formatBRL(totalLucro)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="font-semibold text-gray-800">Preço total ({modAtual.label})</span>
            <span className="text-2xl font-bold text-primary">{formatBRL(totalPreco)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input placeholder="Nome do paciente" value={pacienteNome} onChange={e => setPacienteNome(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <input placeholder="Idade" type="number" value={pacienteIdade} onChange={e => setPacienteIdade(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <textarea placeholder="Formas de pagamento" value={formasPagamento} onChange={e => setFormasPagamento(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 mb-3 resize-none" />
          <textarea placeholder="Observações" value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex gap-3 z-30">
        <div className="max-w-4xl mx-auto flex gap-3 w-full">
          <button onClick={() => buildPDF(false)} className="flex-1 bg-primary text-white rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2">
            <FileText size={16} /> PDF Paciente
          </button>
          <button onClick={() => buildPDF(true)} className="flex-1 bg-danger text-white rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2">
            <Lock size={16} /> PDF Interno
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfig(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-primary">Configurações</h2>
              <button onClick={() => setShowConfig(false)}><X size={18} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">DNA Financeiro</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Meta faturamento/mês" value={config.meta_faturamento} onChange={v => setC('meta_faturamento', v)} />
                  <Field label="Pró-labore desejado" value={config.pro_labore} onChange={v => setC('pro_labore', v)} />
                  <Field label="Horas/dia" value={config.horas_dia} onChange={v => setC('horas_dia', v)} />
                  <Field label="Dias/mês" value={config.dias_mes} onChange={v => setC('dias_mes', v)} />
                  <Field label="Custo fixo/mês" value={config.custo_fixo_mensal} onChange={v => setC('custo_fixo_mensal', v)} />
                  <Field label="Atendimentos/mês" value={config.atendimentos_mes} onChange={v => setC('atendimentos_mes', v)} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Impostos e taxas</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Imposto (%)" value={config.imposto_percentual} onChange={v => setC('imposto_percentual', v)} />
                  <Field label="Desconto espécie (%)" value={config.desconto_especie} onChange={v => setC('desconto_especie', v)} />
                  <Field label="Débito (%)" value={config.taxa_debito} onChange={v => setC('taxa_debito', v)} />
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <Field key={n} label={'Crédito ' + n + 'x (%)'} value={config['taxa_credito_' + n + 'x']} onChange={v => setC('taxa_credito_' + n + 'x', v)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Dados da clínica</p>
                <div className="space-y-2">
                  <Field label="Nome do médico" value={config.nome_medico} onChange={v => setC('nome_medico', v)} full />
                  <Field label="Especialidade" value={config.especialidade} onChange={v => setC('especialidade', v)} full />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="CRM" value={config.crm} onChange={v => setC('crm', v)} />
                    <Field label="RQE" value={config.rqe} onChange={v => setC('rqe', v)} />
                  </div>
                  <Field label="Endereço" value={config.endereco} onChange={v => setC('endereco', v)} full />
                  <Field label="Telefone" value={config.telefone} onChange={v => setC('telefone', v)} full />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setShowConfig(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Fechar</button>
              <button onClick={salvarConfig} className="px-4 py-2 text-sm bg-primary text-white rounded-lg font-medium">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-full outline-none focus:ring-2 focus:ring-primary/30" />
    </div>
  )
}
