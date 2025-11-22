import { supabase } from '../../../lib/supabaseClient'
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).end()
  const { pin } = req.body
  const { data: student } = await supabase.from('students').select('*').eq('pin',pin).single().catch(()=>({data:null}))
  if(!student) return res.status(404).json({error:'not found'})
  // create attempt and generate questions
  const { data: attempt } = await supabase.from('test_attempts').insert([{ student_id: student.id, class_label: student.class_label, started_at: new Date().toISOString(), max_score:25 }]).select().single()
  // generate simple questions into question_records
  const qs = []
  for(let i=1;i<=25;i++){ const base = Math.floor(Math.random()*12)+1; const mult = Math.floor(Math.random()*19)+1; qs.push({ attempt_id: attempt.id, q_index:i, base, multiplier: mult, correct_answer: base*mult }) }
  await supabase.from('question_records').insert(qs)
  res.status(200).json({ attemptId: attempt.id })
}
