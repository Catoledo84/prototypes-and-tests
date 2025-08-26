import './App.css'
import './styles/tokens.css'
import SmartSearchBar from './components/SmartSearchBar'
import type { AstNode } from './components/SmartSearchBar'
import { useMemo, useState } from 'react'

function App() {
  const [ast, setAst] = useState<AstNode | null>(null)
  const rows = [
    { author:'Alice', project:'Dynamic filtering', date:'2025-01-04', status:'active', department:'design', age:31, name:'Alice Johnson' },
    { author:'Bob', project:'Design System', date:'2025-02-11', status:'draft', department:'engineering', age:29, name:'Bob Gray' },
    { author:'Carol', project:'Internal Tools', date:'2025-03-09', status:'archived', department:'ops', age:41, name:'Carol Voss' },
    { author:'Alice', project:'Marketing Site', date:'2025-03-21', status:'active', department:'design', age:35, name:'Alice M.' },
  ] as const

  function compare(operator: string, left: any, right: any): boolean {
    switch (operator) {
      case 'contains': return String(left).toLowerCase().includes(String(right).toLowerCase())
      case '=': return String(left) == String(right)
      case '!=': return String(left) != String(right)
      case '>': return Number(left) > Number(right)
      case '>=': return Number(left) >= Number(right)
      case '<': return Number(left) < Number(right)
      case '<=': return Number(left) <= Number(right)
      default: return false
    }
  }

  function applyFilter(ast: AstNode | null) {
    if (!ast) return rows
    if (ast.kind === 'group') {
      const filtered = rows.filter(row => ast.children.every(c => evaluate(row, c)))
      return filtered
    }
    return rows
  }

  function evaluate(row: any, node: AstNode): boolean {
    if (node.kind === 'group') {
      const evals = node.children.map(n => evaluate(row, n))
      return node.op === 'and' ? evals.every(Boolean) : evals.some(Boolean)
    }
    const value = (row as any)[node.field]
    // If date string, allow numeric comparison via Date
    if (/(^\d{4}-\d{2}-\d{2}$)/.test(String(value)) && /^\d{4}-\d{2}-\d{2}$/.test(String(node.value))) {
      return compare(node.op, new Date(value).getTime(), new Date(node.value).getTime())
    }
    return compare(node.op, value, node.value)
  }

  const filtered = useMemo(() => applyFilter(ast), [ast])

  return (
    <div>
      <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>
        <h2 style={{ color: 'var(--color-text)' }}>Dynamic filtering demo</h2>
        <SmartSearchBar
          placeholder="Type here"
          schema={{
            author: { label: 'Author', type: 'enum', options: ['Alice', 'Bob', 'Carol', 'WTF'] },
            project: { label: 'Project', type: 'relation', options: async (q: string) => {
              const all = ['Dynamic filtering', 'Design System', 'Internal Tools', 'Marketing Site']
              return all.filter(p => p.toLowerCase().includes(q.toLowerCase()))
            } },
            date: { label: 'Date', type: 'date' },
            status: { label: 'Status', type: 'enum', options: ['active', 'archived', 'draft'] },
            department: { label: 'Department', type: 'enum', options: ['design', 'engineering', 'ops'] },
            age: { label: 'Age', type: 'number' },
            name: { label: 'Name', type: 'string' }
          }}
          onChange={(next: AstNode | null) => setAst(next)}
        />

        <div style={{marginTop:24, background:'#fff', border:'1px solid var(--color-border)', borderRadius:'var(--radius)'}}>
          <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left'}}>
            <thead>
              <tr style={{background:'var(--color-surface)'}}>
                <th style={{textAlign:'left', padding:'10px', borderBottom:'1px solid var(--color-border)'}}>Author</th>
                <th style={{textAlign:'left', padding:'10px', borderBottom:'1px solid var(--color-border)'}}>Project</th>
                <th style={{textAlign:'left', padding:'10px', borderBottom:'1px solid var(--color-border)'}}>Date</th>
                <th style={{textAlign:'left', padding:'10px', borderBottom:'1px solid var(--color-border)'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} style={{borderBottom:'1px solid var(--color-border)'}}>
                  <td style={{padding:'10px'}}>{row.author}</td>
                  <td style={{padding:'10px'}}>{row.project}</td>
                  <td style={{padding:'10px'}}>{row.date}</td>
                  <td style={{padding:'10px'}}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default App
