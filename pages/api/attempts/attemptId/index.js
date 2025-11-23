import { supabase } from '../../../../lib/supabaseClient'
export default async function handler(req,res){
  const { attemptId } = req.query
  const { data: att } = await supabase.from('test_attempts').select('*').eq('id',attemptId).single().catch(()=>({data:null}))
  if(!att) return res.status(404).end()
  res.status(200).json(att)
}
