import { supabase } from '../../../../lib/supabaseClient'
export default async function handler(req,res){
  const { attemptId } = req.query
  const { data: q } = await supabase.from('question_records').select('*').eq('attempt_id',attemptId).is('student_answer',null).order('q_index').limit(1).single().catch(()=>({data:null}))
  if(!q) return res.status(204).end()
  await supabase.from('question_records').update({ served_at: new Date().toISOString() }).eq('id',q.id)
  const { data: total } = await supabase.from('question_records').select('q_index').eq('attempt_id',attemptId)
  res.status(200).json({ index: q.q_index, base: q.base, multiplier: q.multiplier, total: total.length })
}
