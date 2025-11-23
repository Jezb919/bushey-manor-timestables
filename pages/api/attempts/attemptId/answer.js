import { supabase } from '../../../../lib/supabaseClient'
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).end()
  const { attemptId } = req.query
  const { answer } = req.body
  const { data: q } = await supabase.from('question_records').select('*').eq('attempt_id',attemptId).is('student_answer',null).order('q_index').limit(1).single().catch(()=>({data:null}))
  if(!q) return res.status(404).json({error:'no question'})
  const numeric = answer===''?null:Number(answer)
  const now = new Date().getTime()
  const served = q.served_at? new Date(q.served_at).getTime():now
  const rt = Math.max(0, now-served)
  const timed_out = rt>6000
  const is_correct = numeric!==null && numeric===q.correct_answer && !timed_out
  await supabase.from('question_records').update({ student_answer: numeric, is_correct, response_time_ms: rt }).eq('id',q.id)
  const { data: remaining } = await supabase.from('question_records').select('id').eq('attempt_id',attemptId).is('student_answer',null)
  if(!remaining || remaining.length===0){
    const { data: all } = await supabase.from('question_records').select('*').eq('attempt_id',attemptId)
    const correct = all.filter(r=>r.is_correct).length
    const avg = all.reduce((a,b)=>a+(b.response_time_ms||0),0)/(all.length||1)
    await supabase.from('test_attempts').update({ score: correct, finished_at: new Date().toISOString(), percent: (correct/all.length)*100, avg_response_time_ms: Math.round(avg), completed:true }).eq('id',attemptId)
  }
  res.status(200).json({ok:true})
}
