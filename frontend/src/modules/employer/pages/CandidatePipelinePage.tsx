/**
 * Phase 3+ — Candidate Pipeline Page (Employer)
 * LinkedIn/Naukri-style candidate pipeline with full profile drawer,
 * search, filter, sort, bulk actions, recruiter notes, and CSV export.
 */
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import {
  getJobPipeline, updateApplicationStatus, updateApplicationNote, bulkUpdateApplicationStatus,
  scheduleInterview, submitInterviewFeedback, cancelInterview, rescheduleInterview,
  sendCandidateEmail, getCandidateEmails, bulkEmailCandidates,
  sendOfferLetter, getOfferLetter, downloadOfferLetterPdf,
  saveCandidate, unsaveCandidate, checkCandidateSaved,
  downloadInterviewIcs,
  type CandidateOut,
} from '@/api/matching'
import type { PipelineStage } from '@/api/matching'
import { getApiError } from '@/api/client'
import {
  Search, X, Download, ChevronDown, ChevronUp, SlidersHorizontal,
  FileText, Briefcase, GraduationCap, Brain, TrendingUp, MapPin,
  CheckCircle2, Clock, AlertCircle, Star, Users, ArrowLeft,
  MessageSquare, BookOpen, LayoutGrid, List as ListIcon,
  CalendarPlus, Video, Ban, Mail, Send, Star as StarIcon, CalendarDays,
  Settings2, Plus, Trash2, GripVertical,
} from 'lucide-react'
import {
  useHasPermission, usePipelineStages, useBulkUpsertPipelineStages,
  usePipelineTemplates, useCreatePipelineTemplate, useDeletePipelineTemplate, useApplyTemplateToJob,
} from '../hooks/useJobs'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'screening',           label: 'Move to Screening',  color: '#D97706' },
  { value: 'shortlisted',         label: 'Shortlist',          color: '#059669' },
  { value: 'interview_scheduled', label: 'Schedule Interview', color: '#3B82F6' },
  { value: 'interview_completed', label: 'Mark Interviewed',   color: '#0EA5E9' },
  { value: 'offer_sent',          label: 'Send Offer',         color: '#7C3AED' },
  { value: 'rejected',            label: 'Reject',             color: '#DC2626' },
  { value: 'hired',               label: 'Mark as Hired',      color: '#7C3AED' },
]

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  applied:              { bg: 'rgba(59,130,246,0.1)',   text: '#2563EB' },
  under_review:         { bg: 'rgba(217,119,6,0.1)',    text: '#D97706' },
  screening:            { bg: 'rgba(217,119,6,0.1)',    text: '#D97706' },
  shortlisted:          { bg: 'rgba(5,150,105,0.1)',    text: '#059669' },
  interview_scheduled:  { bg: 'rgba(59,130,246,0.1)',   text: '#3B82F6' },
  interview_completed:  { bg: 'rgba(14,165,233,0.1)',   text: '#0EA5E9' },
  offer_sent:           { bg: 'rgba(124,58,237,0.1)',   text: '#7C3AED' },
  rejected:             { bg: 'rgba(220,38,38,0.1)',    text: '#DC2626' },
  hired:                { bg: 'rgba(124,58,237,0.1)',   text: '#7C3AED' },
  withdrawn:            { bg: 'rgba(107,114,128,0.08)', text: '#9CA3AF' },
}

// Default kanban columns — used when no custom pipeline stages are configured for the job.
const DEFAULT_KANBAN_STAGES: PipelineStage[] = [
  { id: '', stage_key: 'applied',              display_name: 'Applied',       color: '#3B82F6', position: 0, is_visible: true },
  { id: '', stage_key: 'screening',            display_name: 'Screening',     color: '#D97706', position: 1, is_visible: true },
  { id: '', stage_key: 'shortlisted',          display_name: 'Shortlisted',   color: '#059669', position: 2, is_visible: true },
  { id: '', stage_key: 'interview_scheduled',  display_name: 'Interview',     color: '#6366F1', position: 3, is_visible: true },
  { id: '', stage_key: 'interview_completed',  display_name: 'Interviewed',   color: '#0EA5E9', position: 4, is_visible: true },
  { id: '', stage_key: 'offer_sent',           display_name: 'Offer Sent',    color: '#7C3AED', position: 5, is_visible: true },
  { id: '', stage_key: 'hired',                display_name: 'Hired',         color: '#059669', position: 6, is_visible: true },
  { id: '', stage_key: 'rejected',             display_name: 'Rejected',      color: '#DC2626', position: 7, is_visible: true },
]

const SORT_OPTIONS = [
  { value: 'match_score', label: 'Best Match' },
  { value: 'applied_at',  label: 'Newest First' },
  { value: 'krs',         label: 'KRS Score' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, color = '#3B82F6' }: { label: string; score: number | null; color?: string }) {
  if (score === null) return null
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94A3B8', marginBottom: 3 }}>
        <span>{label}</span><span style={{ color, fontWeight: 700 }}>{score}</span>
      </div>
      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 20 }} />
      </div>
    </div>
  )
}

function exportToCSV(candidates: CandidateOut[], jobTitle: string) {
  const headers = [
    'Name','City','State','Gender','Qualification','Degree','Field','Institution','Grad Year',
    'UPSC Attempts','Highest Stage','Years Preparing','Optional Subject',
    'Work Exp','Work Years','Work Domain','Last Designation',
    'Skills','K Score','R Score','S Score','Composite','Match Score',
    'Salary Min','Salary Max','Status','Cover Note','Applied (days ago)',
  ]
  const rows = candidates.map(c => [
    c.full_name??'',c.city??'',c.state??'',c.gender??'',
    c.highest_qualification??'',c.degree??'',c.field_of_study??'',c.institution??'',c.graduation_year??'',
    c.upsc_attempts??'',c.highest_stage_cleared??'',c.years_preparing??'',c.optional_subject??'',
    c.has_work_experience?'Yes':'No',c.work_experience_years??'',c.work_experience_domain??'',c.last_designation??'',
    (c.skills??[]).join('; '),c.k_score??'',c.r_score??'',c.s_score??'',c.composite??'',c.match_score??'',
    c.expected_salary_min??'',c.expected_salary_max??'',c.status,(c.cover_note??'').replace(/"/g,'""'),c.days_ago,
  ])
  const csv=[headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const blob=new Blob([csv],{type:'text/csv'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url;a.download=`${jobTitle.replace(/\s+/g,'_')}_candidates.csv`;a.click()
  URL.revokeObjectURL(url)
}

function Section({icon,title,children}:{icon:React.ReactNode;title:string;children:React.ReactNode}){
  return(
    <div style={{background:'#F8FAFC',borderRadius:14,padding:'14px 16px',border:'1px solid #E2E8F0'}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:12}}>
        <span style={{color:'#64748B'}}>{icon}</span>
        <h3 style={{fontSize:11,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'0.5px',margin:0}}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function InfoRow({label,value}:{label:string;value:string}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:5}}>
      <span style={{fontSize:12,color:'#94A3B8',flexShrink:0}}>{label}</span>
      <span style={{fontSize:12,color:'#1E293B',fontWeight:600,textAlign:'right'}}>{value}</span>
    </div>
  )
}

function FilterTab({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}){
  return(
    <button onClick={onClick} style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,border:active?'none':'1px solid #E5E7EB',background:active?'#1E293B':'#fff',color:active?'#fff':'#64748B',cursor:'pointer',textTransform:'capitalize'}}>
      {label}
    </button>
  )
}

function StatChip({label,value,color}:{label:string;value:string;color:string}){
  return(
    <span style={{padding:'3px 8px',borderRadius:20,fontSize:10,fontWeight:700,background:`${color}16`,color,border:`1px solid ${color}28`}}>
      {label}: {value}
    </span>
  )
}

// ── Profile Drawer ────────────────────────────────────────────────────────────

function ProfileDrawer({candidate,jobId,onClose}:{candidate:CandidateOut;jobId:string;onClose:()=>void}){
  const qc=useQueryClient()
  const canMoveCandidate=useHasPermission('candidates:shortlist')
  const canInterview=useHasPermission('candidates:interview')
  const [selectedStatus,setSelectedStatus]=useState('')
  const [statusNote,setStatusNote]=useState('')
  const [recruiterNote,setRecruiterNote]=useState(candidate.employer_note??'')
  const [noteSaved,setNoteSaved]=useState(false)

  const updateMutation=useMutation({
    mutationFn:()=>updateApplicationStatus(candidate.application_id,selectedStatus,statusNote||undefined),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['pipeline',jobId]});setSelectedStatus('');setStatusNote('')},
  })
  const noteMutation=useMutation({
    mutationFn:()=>updateApplicationNote(candidate.application_id,recruiterNote),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['pipeline',jobId]});setNoteSaved(true);setTimeout(()=>setNoteSaved(false),2500)},
  })

  const [scheduleAt,setScheduleAt]=useState('')
  const [meetingLink,setMeetingLink]=useState('')
  const [showScheduleForm,setShowScheduleForm]=useState(false)
  const [feedbackForId,setFeedbackForId]=useState<string|null>(null)
  const [feedbackRecommendation,setFeedbackRecommendation]=useState('')
  const [feedbackText,setFeedbackText]=useState('')

  const scheduleMutation=useMutation({
    mutationFn:()=>scheduleInterview(candidate.application_id,{scheduled_at:new Date(scheduleAt).toISOString(),meeting_link:meetingLink||undefined}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['pipeline',jobId]});setShowScheduleForm(false);setScheduleAt('');setMeetingLink('')},
  })

  const [rescheduleForId,setRescheduleForId]=useState<string|null>(null)
  const [rescheduleAt,setRescheduleAt]=useState('')
  const [rescheduleLink,setRescheduleLink]=useState('')
  const rescheduleMutation=useMutation({
    mutationFn:(interviewId:string)=>rescheduleInterview(candidate.application_id,interviewId,{scheduled_at:new Date(rescheduleAt).toISOString(),meeting_link:rescheduleLink||undefined}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['pipeline',jobId]});setRescheduleForId(null);setRescheduleAt('');setRescheduleLink('')},
  })
  const feedbackMutation=useMutation({
    mutationFn:(interviewId:string)=>submitInterviewFeedback(candidate.application_id,interviewId,{recommendation:feedbackRecommendation||undefined,feedback:feedbackText||undefined}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['pipeline',jobId]});setFeedbackForId(null);setFeedbackRecommendation('');setFeedbackText('')},
  })
  const cancelInterviewMutation=useMutation({
    mutationFn:(interviewId:string)=>cancelInterview(candidate.application_id,interviewId),
    onSuccess:()=>qc.invalidateQueries({queryKey:['pipeline',jobId]}),
  })

  const [emailSubject,setEmailSubject]=useState('')
  const [emailBody,setEmailBody]=useState('')
  const [showEmailHistory,setShowEmailHistory]=useState(false)
  const {data:emailHistory}=useQuery({
    queryKey:['candidate-emails',candidate.application_id],
    queryFn:()=>getCandidateEmails(candidate.application_id),
  })
  const sendEmailMutation=useMutation({
    mutationFn:()=>sendCandidateEmail(candidate.application_id,emailSubject,emailBody),
    onSuccess:()=>{
      qc.invalidateQueries({queryKey:['candidate-emails',candidate.application_id]})
      setEmailSubject('');setEmailBody('')
    },
  })

  const [showOfferForm,setShowOfferForm]=useState(false)
  const [offerForm,setOfferForm]=useState({
    role_title: candidate.job_title ?? '',
    salary_ctc: '',
    start_date: '',
    work_location: '',
    employment_type: 'Full-Time',
    company_address: '',
    hiring_manager_name: '',
    hiring_manager_designation: '',
    extra_clauses: '',
  })
  const {data:offerLetter}=useQuery({
    queryKey:['offer-letter',candidate.application_id],
    queryFn:()=>getOfferLetter(candidate.application_id),
  })
  const offerMutation=useMutation({
    mutationFn:()=>sendOfferLetter(candidate.application_id,{
      ...offerForm,
      company_address: offerForm.company_address||undefined,
      extra_clauses: offerForm.extra_clauses||undefined,
    }),
    onSuccess:()=>{
      qc.invalidateQueries({queryKey:['offer-letter',candidate.application_id]})
      setShowOfferForm(false)
    },
  })
  const offerStatusStyle:Record<string,{bg:string;text:string;label:string}>={
    sent:{bg:'rgba(124,58,237,0.1)',text:'#7C3AED',label:'Awaiting response'},
    accepted:{bg:'rgba(5,150,105,0.1)',text:'#059669',label:'Accepted & signed'},
    declined:{bg:'rgba(220,38,38,0.1)',text:'#DC2626',label:'Declined'},
  }

  const {data:savedState}=useQuery({
    queryKey:['candidate-saved',candidate.aspirant_id],
    queryFn:()=>checkCandidateSaved(candidate.aspirant_id),
  })
  const saveMutation=useMutation({
    mutationFn:()=>saveCandidate(candidate.aspirant_id),
    onSuccess:()=>qc.invalidateQueries({queryKey:['candidate-saved',candidate.aspirant_id]}),
  })
  const unsaveMutation=useMutation({
    mutationFn:()=>unsaveCandidate(candidate.aspirant_id),
    onSuccess:()=>qc.invalidateQueries({queryKey:['candidate-saved',candidate.aspirant_id]}),
  })
  const isSaved=savedState?.saved??false

  const isTerminal=['withdrawn','hired','rejected'].includes(candidate.status)
  const st=STATUS_STYLE[candidate.status]??{bg:'#F3F4F6',text:'#6B7280'}

  return(
    <div style={{position:'fixed',inset:0,zIndex:100,background:'rgba(15,23,42,0.45)',backdropFilter:'blur(4px)',display:'flex',justifyContent:'flex-end'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{width:'100%',maxWidth:680,height:'100vh',background:'#fff',overflowY:'auto',display:'flex',flexDirection:'column',boxShadow:'-8px 0 48px rgba(15,23,42,0.18)'}}>
        {/* Header */}
        <div style={{padding:'18px 24px',borderBottom:'1px solid #E5E7EB',position:'sticky',top:0,background:'#fff',zIndex:10,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#3B82F6,#1D4ED8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#fff',flexShrink:0}}>
              {(candidate.full_name||'A')[0].toUpperCase()}
            </div>
            <div>
              <h2 style={{fontSize:16,fontWeight:800,color:'#0F172A',margin:0}}>{candidate.full_name??'Anonymous'}</h2>
              <p style={{fontSize:11,color:'#64748B',marginTop:2}}>
                {[candidate.city,candidate.state].filter(Boolean).join(', ')||'Location N/A'}
                {candidate.gender?` · ${candidate.gender}`:''}
                {' · Applied '}<strong>{candidate.days_ago===0?'today':`${candidate.days_ago}d ago`}</strong>
              </p>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700,background:st.bg,color:st.text,textTransform:'capitalize'}}>{candidate.status.replace('_',' ')}</span>
            <button
              onClick={()=>isSaved?unsaveMutation.mutate():saveMutation.mutate()}
              disabled={saveMutation.isPending||unsaveMutation.isPending}
              title={isSaved?'Remove from talent pool':'Save to talent pool'}
              style={{width:32,height:32,border:'none',background:isSaved?'rgba(217,119,6,0.12)':'#F1F5F9',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <StarIcon size={16} color={isSaved?'#D97706':'#64748B'} fill={isSaved?'#D97706':'none'}/>
            </button>
            <button onClick={onClose} style={{width:32,height:32,border:'none',background:'#F1F5F9',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={16} color="#64748B"/></button>
          </div>
        </div>

        {/* Body */}
        <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:16,flex:1}}>
          {/* Match + KRS summary */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {candidate.match_score!==null&&(
              <div style={{background:'rgba(59,130,246,0.04)',border:'1px solid rgba(59,130,246,0.12)',borderRadius:14,padding:'14px 16px'}}>
                <p style={{fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',marginBottom:8}}>Job Match</p>
                <div style={{fontSize:32,fontWeight:900,color:candidate.match_score>=70?'#059669':candidate.match_score>=40?'#D97706':'#DC2626',lineHeight:1}}>{candidate.match_score}%</div>
              </div>
            )}
            {candidate.composite!==null&&(
              <div style={{background:'rgba(124,58,237,0.04)',border:'1px solid rgba(124,58,237,0.12)',borderRadius:14,padding:'14px 16px'}}>
                <p style={{fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',marginBottom:8}}>KRS Composite</p>
                <div style={{fontSize:32,fontWeight:900,color:'#7C3AED',lineHeight:1}}>{candidate.composite}</div>
              </div>
            )}
          </div>

          <Section icon={<Mail size={13}/>} title="Email Candidate">
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} placeholder="Subject…" maxLength={255}
                style={{width:'100%',border:'1px solid #E2E8F0',borderRadius:10,padding:'9px 12px',fontSize:13,outline:'none',color:'#1E293B',boxSizing:'border-box'}}/>
              <textarea value={emailBody} onChange={e=>setEmailBody(e.target.value)} placeholder="Write your message…" rows={4} maxLength={10000}
                style={{width:'100%',border:'1px solid #E2E8F0',borderRadius:10,padding:'10px 12px',fontSize:13,resize:'none',outline:'none',color:'#1E293B',fontFamily:'inherit',boxSizing:'border-box'}}/>
              {sendEmailMutation.isError&&(
                <p style={{fontSize:12,color:'#DC2626',margin:0}}>{getApiError(sendEmailMutation.error)}</p>
              )}
              {sendEmailMutation.isSuccess&&(
                <p style={{fontSize:12,color:'#059669',margin:0}}>✓ Email sent.</p>
              )}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                <button onClick={()=>setShowEmailHistory(v=>!v)} style={{fontSize:11,fontWeight:700,color:'#64748B',background:'none',border:'none',cursor:'pointer'}}>
                  {emailHistory?.length?`${emailHistory.length} email${emailHistory.length===1?'':'s'} sent`:'No emails sent yet'}{emailHistory?.length?(showEmailHistory?' ▲':' ▼'):''}
                </button>
                <button onClick={()=>sendEmailMutation.mutate()} disabled={!emailSubject.trim()||!emailBody.trim()||sendEmailMutation.isPending}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:8,border:'none',fontSize:12,fontWeight:700,
                    background:(!emailSubject.trim()||!emailBody.trim())?'#E2E8F0':'#3B82F6',
                    color:(!emailSubject.trim()||!emailBody.trim())?'#94A3B8':'#fff',
                    cursor:(!emailSubject.trim()||!emailBody.trim()||sendEmailMutation.isPending)?'not-allowed':'pointer'}}>
                  <Send size={12}/>{sendEmailMutation.isPending?'Sending…':'Send'}
                </button>
              </div>
              {showEmailHistory&&emailHistory&&emailHistory.length>0&&(
                <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4,borderTop:'1px solid #E2E8F0',paddingTop:10}}>
                  {emailHistory.map(e=>(
                    <div key={e.id} style={{background:'#F8FAFC',borderRadius:8,padding:'8px 10px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                        <span style={{fontSize:12,fontWeight:700,color:'#1E293B'}}>{e.subject}</span>
                        <span style={{fontSize:10,color:'#94A3B8',whiteSpace:'nowrap'}}>{new Date(e.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
                      </div>
                      <p style={{fontSize:11,color:'#64748B',margin:'4px 0 0',whiteSpace:'pre-wrap'}}>{e.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {(['offer_sent','hired'].includes(candidate.status)||offerLetter)&&(
            <Section icon={<FileText size={13}/>} title="Offer Letter">
              {offerLetter&&(
                <div style={{marginBottom:showOfferForm?12:0,padding:'10px 12px',borderRadius:10,background:'#F8FAFC',border:'1px solid #E2E8F0'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:offerLetter.status!=='sent'?6:0}}>
                    <span style={{
                      fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,
                      background:offerStatusStyle[offerLetter.status]?.bg,color:offerStatusStyle[offerLetter.status]?.text,
                    }}>
                      {offerStatusStyle[offerLetter.status]?.label??offerLetter.status}
                    </span>
                    <button
                      onClick={()=>downloadOfferLetterPdf(candidate.application_id)}
                      style={{display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontWeight:700,color:'#7C3AED',background:'none',border:'none',cursor:'pointer',padding:0}}
                    >
                      <Download size={12}/>Download PDF
                    </button>
                  </div>
                  {offerLetter.status==='accepted'&&(
                    <p style={{fontSize:12,color:'#059669',margin:0}}>
                      Digitally signed by <strong>{offerLetter.signature_name}</strong>
                      {offerLetter.responded_at?` on ${new Date(offerLetter.responded_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`:''}.
                    </p>
                  )}
                  {offerLetter.status==='declined'&&(
                    <p style={{fontSize:12,color:'#DC2626',margin:0}}>
                      Candidate declined{offerLetter.decline_reason?`: "${offerLetter.decline_reason}"`:'.'}
                    </p>
                  )}
                </div>
              )}
              {offerLetter&&offerLetter.status!=='sent'?null:!showOfferForm?(
                <button
                  onClick={()=>setShowOfferForm(true)}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:9,border:'none',background:'#7C3AED',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',width:'100%',justifyContent:'center'}}
                >
                  <FileText size={13}/>{offerLetter?'Edit & Resend Offer':'Send Offer Letter'}
                </button>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {[
                    {key:'role_title',label:'Role Title *',placeholder:'e.g. Policy Analyst'},
                    {key:'salary_ctc',label:'Annual CTC *',placeholder:'e.g. ₹8,00,000 per annum'},
                    {key:'start_date',label:'Start Date *',placeholder:'e.g. 01 August 2026'},
                    {key:'work_location',label:'Work Location *',placeholder:'e.g. New Delhi (On-site)'},
                    {key:'company_address',label:'Company Address',placeholder:'Optional — printed on letterhead'},
                    {key:'hiring_manager_name',label:'Hiring Manager Name *',placeholder:'e.g. Rahul Sharma'},
                    {key:'hiring_manager_designation',label:'Manager Designation *',placeholder:'e.g. Head of Talent'},
                  ].map(({key,label,placeholder})=>(
                    <div key={key}>
                      <p style={{fontSize:11,fontWeight:600,color:'#64748B',margin:'0 0 4px'}}>{label}</p>
                      <input
                        value={offerForm[key as keyof typeof offerForm]}
                        onChange={e=>setOfferForm(f=>({...f,[key]:e.target.value}))}
                        placeholder={placeholder}
                        style={{width:'100%',height:34,padding:'0 10px',borderRadius:8,border:'1px solid #E5E7EB',fontSize:12,outline:'none',boxSizing:'border-box'}}
                      />
                    </div>
                  ))}
                  <div>
                    <p style={{fontSize:11,fontWeight:600,color:'#64748B',margin:'0 0 4px'}}>Employment Type</p>
                    <select
                      value={offerForm.employment_type}
                      onChange={e=>setOfferForm(f=>({...f,employment_type:e.target.value}))}
                      style={{width:'100%',height:34,padding:'0 10px',borderRadius:8,border:'1px solid #E5E7EB',fontSize:12,outline:'none',background:'#fff'}}
                    >
                      {['Full-Time','Part-Time','Contract','Internship','Consulting'].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <p style={{fontSize:11,fontWeight:600,color:'#64748B',margin:'0 0 4px'}}>Additional Clauses <span style={{fontWeight:400}}>(optional, one per line)</span></p>
                    <textarea
                      value={offerForm.extra_clauses}
                      onChange={e=>setOfferForm(f=>({...f,extra_clauses:e.target.value}))}
                      placeholder={'e.g. 3-month probation period\nStock options vest over 4 years'}
                      rows={3}
                      style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #E5E7EB',fontSize:12,outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}}
                    />
                  </div>
                  {offerMutation.isError&&<p style={{fontSize:11,color:'#DC2626',margin:0}}>Failed to send offer letter. Please try again.</p>}
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>setShowOfferForm(false)} style={{flex:1,height:34,borderRadius:8,border:'1px solid #E5E7EB',background:'none',fontSize:12,fontWeight:600,color:'#6B7280',cursor:'pointer'}}>Cancel</button>
                    <button
                      onClick={()=>offerMutation.mutate()}
                      disabled={!offerForm.role_title.trim()||!offerForm.salary_ctc.trim()||!offerForm.start_date.trim()||!offerForm.work_location.trim()||!offerForm.hiring_manager_name.trim()||!offerForm.hiring_manager_designation.trim()||offerMutation.isPending}
                      style={{flex:2,height:34,borderRadius:8,border:'none',background:'#7C3AED',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,opacity:(offerMutation.isPending)?0.7:1}}
                    >
                      <Send size={13}/>{offerMutation.isPending?'Sending…':'Send to Candidate'}
                    </button>
                  </div>
                </div>
              )}
            </Section>
          )}

          {(candidate.k_score!==null||candidate.r_score!==null||candidate.s_score!==null)&&(
            <Section icon={<TrendingUp size={13}/>} title="KRS Score Breakdown">
              <ScoreBar label="Knowledge (K)" score={candidate.k_score} color="#3B82F6"/>
              <ScoreBar label="Readiness (R)" score={candidate.r_score} color="#7C3AED"/>
              <ScoreBar label="Skill Match (S)" score={candidate.s_score} color="#059669"/>
            </Section>
          )}

          {candidate.highest_qualification&&(
            <Section icon={<GraduationCap size={13}/>} title="Education">
              <InfoRow label="Qualification" value={candidate.highest_qualification}/>
              {candidate.degree&&<InfoRow label="Degree" value={`${candidate.degree}${candidate.field_of_study?` in ${candidate.field_of_study}`:''}`}/>}
              {candidate.institution&&<InfoRow label="Institution" value={candidate.institution}/>}
              {candidate.graduation_year&&<InfoRow label="Graduation Year" value={String(candidate.graduation_year)}/>}
            </Section>
          )}

          <Section icon={<BookOpen size={13}/>} title="UPSC Journey">
            {candidate.upsc_attempts!==null&&<InfoRow label="Attempts" value={String(candidate.upsc_attempts)}/>}
            {candidate.highest_stage_cleared&&<InfoRow label="Highest Stage" value={candidate.highest_stage_cleared.replace(/_/g,' ')}/>}
            {candidate.years_preparing!=null&&<InfoRow label="Years Preparing" value={`${candidate.years_preparing} yr${candidate.years_preparing===1?'':'s'}`}/>}
            {candidate.optional_subject&&<InfoRow label="Optional Subject" value={candidate.optional_subject}/>}
          </Section>

          {candidate.has_work_experience&&(
            <Section icon={<Briefcase size={13}/>} title="Work Experience">
              {candidate.work_experience_years!=null&&<InfoRow label="Experience" value={`${candidate.work_experience_years} yr${candidate.work_experience_years===1?'':'s'}`}/>}
              {candidate.work_experience_domain&&<InfoRow label="Domain" value={candidate.work_experience_domain}/>}
              {candidate.last_designation&&<InfoRow label="Last Designation" value={candidate.last_designation}/>}
            </Section>
          )}

          {candidate.skills.length>0&&(
            <Section icon={<Star size={13}/>} title="Skills">
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {candidate.skills.map(s=>(
                  <span key={s} style={{padding:'3px 10px',background:'rgba(59,130,246,0.07)',border:'1px solid rgba(59,130,246,0.12)',borderRadius:20,fontSize:11,fontWeight:600,color:'#3B82F6'}}>{s}</span>
                ))}
              </div>
            </Section>
          )}

          {candidate.psych&&(
            <Section icon={<Brain size={13}/>} title="Psychological Profile">
              <ScoreBar label="Confidence" score={candidate.psych.confidence_index} color="#059669"/>
              <ScoreBar label="Burnout Level" score={candidate.psych.burnout_score} color="#EF4444"/>
              <ScoreBar label="Financial Pressure" score={candidate.psych.financial_pressure_score} color="#D97706"/>
              {candidate.psych.risk_tolerance&&<InfoRow label="Risk Tolerance" value={candidate.psych.risk_tolerance.replace(/_/g,' ')}/>}
              {candidate.psych.motivation_type&&<InfoRow label="Motivation Type" value={candidate.psych.motivation_type.replace(/_/g,' ')}/>}
            </Section>
          )}

          {(candidate.expected_salary_min||candidate.expected_salary_max||candidate.open_to_relocation!=null)&&(
            <Section icon={<MapPin size={13}/>} title="Preferences">
              {(candidate.expected_salary_min||candidate.expected_salary_max)&&<InfoRow label="Expected Salary" value={`₹${candidate.expected_salary_min??'?'}–${candidate.expected_salary_max??'?'} LPA`}/>}
              {candidate.open_to_relocation!=null&&<InfoRow label="Open to Relocation" value={candidate.open_to_relocation?'Yes':'No'}/>}
              {candidate.preferred_locations&&candidate.preferred_locations.length>0&&<InfoRow label="Preferred Locations" value={candidate.preferred_locations.join(', ')}/>}
            </Section>
          )}

          {candidate.cover_note&&(
            <Section icon={<FileText size={13}/>} title="Cover Note">
              <p style={{fontSize:13,color:'#475569',lineHeight:1.6,fontStyle:'italic',margin:0}}>"{candidate.cover_note}"</p>
            </Section>
          )}

          {candidate.status_history.length>0&&(
            <Section icon={<Clock size={13}/>} title="Application Timeline">
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {candidate.status_history.map((h,i)=>(
                  <div key={i} style={{display:'flex',gap:10}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:'#3B82F6',flexShrink:0,marginTop:4}}/>
                    <div>
                      <p style={{fontSize:12,fontWeight:600,color:'#1E293B',margin:0}}>{h.from_status?`${h.from_status.replace('_',' ')} → `:''}{h.to_status.replace('_',' ')}</p>
                      {h.note&&<p style={{fontSize:11,color:'#64748B',margin:'2px 0 0'}}>{h.note}</p>}
                      <p style={{fontSize:11,color:'#94A3B8',margin:'2px 0 0'}}>{new Date(h.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section icon={<Video size={13}/>} title="Interviews">
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {candidate.interview_feedback.length===0&&!showScheduleForm&&(
                <p style={{fontSize:12,color:'#94A3B8',margin:0}}>No interviews scheduled yet.</p>
              )}
              {candidate.interview_feedback.map(iv=>(
                <div key={iv.id} style={{border:'1px solid #E2E8F0',borderRadius:10,padding:'10px 12px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#1E293B'}}>
                      {iv.scheduled_at?new Date(iv.scheduled_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}
                    </span>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,
                      background:iv.status==='scheduled'?'rgba(59,130,246,0.1)':iv.status==='completed'?'rgba(5,150,105,0.1)':'rgba(220,38,38,0.1)',
                      color:iv.status==='scheduled'?'#3B82F6':iv.status==='completed'?'#059669':'#DC2626'}}>
                      {iv.status}
                    </span>
                  </div>
                  {iv.meeting_link&&(
                    <a href={iv.meeting_link} target="_blank" rel="noreferrer" style={{fontSize:11,color:'#3B82F6',display:'block',marginTop:4}}>{iv.meeting_link}</a>
                  )}
                  {iv.status==='scheduled'&&(
                    <button onClick={()=>downloadInterviewIcs(candidate.application_id,iv.id)}
                      style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,color:'#64748B',background:'none',border:'none',cursor:'pointer',marginTop:6,padding:0}}>
                      <CalendarDays size={12}/>Add to calendar
                    </button>
                  )}

                  {iv.reschedule_requested_at&&rescheduleForId!==iv.id&&(
                    <div style={{marginTop:8,background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:8,padding:'8px 10px'}}>
                      <p style={{fontSize:11.5,fontWeight:700,color:'#92400E',margin:0}}>Candidate requested a reschedule</p>
                      <p style={{fontSize:11.5,color:'#78350F',margin:'2px 0 6px'}}>"{iv.reschedule_note}"</p>
                      {canInterview&&(
                        <button onClick={()=>{setRescheduleForId(iv.id);setRescheduleAt('');setRescheduleLink(iv.meeting_link??'')}}
                          style={{fontSize:11,fontWeight:700,color:'#3B82F6',background:'none',border:'none',cursor:'pointer',padding:0}}>
                          Pick a new time
                        </button>
                      )}
                    </div>
                  )}

                  {rescheduleForId===iv.id&&(
                    <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                      <input type="datetime-local" value={rescheduleAt} onChange={e=>setRescheduleAt(e.target.value)}
                        style={{border:'1px solid #E2E8F0',borderRadius:8,padding:'6px 8px',fontSize:12}}/>
                      <input type="url" value={rescheduleLink} onChange={e=>setRescheduleLink(e.target.value)} placeholder="Meeting link (optional)"
                        style={{border:'1px solid #E2E8F0',borderRadius:8,padding:'6px 8px',fontSize:12}}/>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>setRescheduleForId(null)} style={{flex:1,padding:6,borderRadius:8,border:'1px solid #E2E8F0',background:'#fff',fontSize:11,fontWeight:600,cursor:'pointer'}}>Cancel</button>
                        <button onClick={()=>rescheduleMutation.mutate(iv.id)} disabled={!rescheduleAt||rescheduleMutation.isPending}
                          style={{flex:1,padding:6,borderRadius:8,border:'none',background:'#3B82F6',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',opacity:!rescheduleAt?0.5:1}}>
                          {rescheduleMutation.isPending?'Saving…':'Confirm new time'}
                        </button>
                      </div>
                    </div>
                  )}

                  {iv.recommendation&&<p style={{fontSize:11,color:'#475569',marginTop:6}}><strong>Recommendation:</strong> {iv.recommendation.replace('_',' ')}</p>}
                  {iv.feedback&&<p style={{fontSize:11,color:'#475569',marginTop:2}}>{iv.feedback}</p>}

                  {iv.status==='scheduled'&&feedbackForId!==iv.id&&rescheduleForId!==iv.id&&canInterview&&(
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button onClick={()=>setFeedbackForId(iv.id)} style={{fontSize:11,fontWeight:700,color:'#059669',background:'none',border:'none',cursor:'pointer'}}>Add feedback</button>
                      {!iv.reschedule_requested_at&&(
                        <button onClick={()=>{setRescheduleForId(iv.id);setRescheduleAt('');setRescheduleLink(iv.meeting_link??'')}} style={{fontSize:11,fontWeight:700,color:'#3B82F6',background:'none',border:'none',cursor:'pointer'}}>Reschedule</button>
                      )}
                      <button onClick={()=>cancelInterviewMutation.mutate(iv.id)} disabled={cancelInterviewMutation.isPending} style={{fontSize:11,fontWeight:700,color:'#DC2626',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Ban size={11}/>Cancel</button>
                    </div>
                  )}
                  {feedbackForId===iv.id&&(
                    <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                      <select value={feedbackRecommendation} onChange={e=>setFeedbackRecommendation(e.target.value)}
                        style={{border:'1px solid #E2E8F0',borderRadius:8,padding:'6px 8px',fontSize:12}}>
                        <option value="">Recommendation…</option>
                        <option value="strong_yes">Strong Yes</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                        <option value="strong_no">Strong No</option>
                      </select>
                      <textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} rows={2} placeholder="Feedback notes…"
                        style={{border:'1px solid #E2E8F0',borderRadius:8,padding:'6px 8px',fontSize:12,resize:'none',fontFamily:'inherit'}}/>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>setFeedbackForId(null)} style={{flex:1,padding:6,borderRadius:8,border:'1px solid #E2E8F0',background:'#fff',fontSize:11,fontWeight:600,cursor:'pointer'}}>Cancel</button>
                        <button onClick={()=>feedbackMutation.mutate(iv.id)} disabled={feedbackMutation.isPending} style={{flex:1,padding:6,borderRadius:8,border:'none',background:'#059669',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                          {feedbackMutation.isPending?'Saving…':'Submit'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {canInterview&&(showScheduleForm?(
                <div style={{border:'1px dashed #93C5FD',borderRadius:10,padding:10,display:'flex',flexDirection:'column',gap:6}}>
                  <input type="datetime-local" value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)}
                    style={{border:'1px solid #E2E8F0',borderRadius:8,padding:'6px 8px',fontSize:12}}/>
                  <input type="url" value={meetingLink} onChange={e=>setMeetingLink(e.target.value)} placeholder="Meeting link (optional)"
                    style={{border:'1px solid #E2E8F0',borderRadius:8,padding:'6px 8px',fontSize:12}}/>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>setShowScheduleForm(false)} style={{flex:1,padding:6,borderRadius:8,border:'1px solid #E2E8F0',background:'#fff',fontSize:11,fontWeight:600,cursor:'pointer'}}>Cancel</button>
                    <button onClick={()=>scheduleMutation.mutate()} disabled={!scheduleAt||scheduleMutation.isPending}
                      style={{flex:1,padding:6,borderRadius:8,border:'none',background:'#3B82F6',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',opacity:!scheduleAt?0.5:1}}>
                      {scheduleMutation.isPending?'Scheduling…':'Schedule'}
                    </button>
                  </div>
                </div>
              ):(
                <button onClick={()=>setShowScheduleForm(true)} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:8,borderRadius:8,border:'1px dashed #93C5FD',background:'none',color:'#3B82F6',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                  <CalendarPlus size={13}/>Schedule Interview
                </button>
              ))}
            </div>
          </Section>

          <Section icon={<MessageSquare size={13}/>} title="Private Recruiter Note">
            <textarea value={recruiterNote} onChange={e=>setRecruiterNote(e.target.value)} placeholder="Internal notes (not visible to applicant)..." rows={3} maxLength={1000}
              style={{width:'100%',border:'1px solid #E2E8F0',borderRadius:10,padding:'10px 12px',fontSize:13,resize:'none',outline:'none',color:'#1E293B',fontFamily:'inherit',boxSizing:'border-box'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:10,marginTop:8}}>
              {noteSaved&&<span style={{fontSize:12,color:'#059669',fontWeight:600}}>✓ Saved</span>}
              <button onClick={()=>noteMutation.mutate()} disabled={noteMutation.isPending}
                style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#1E293B',color:'#fff',fontSize:12,fontWeight:700,cursor:noteMutation.isPending?'not-allowed':'pointer'}}>
                {noteMutation.isPending?'Saving…':'Save Note'}
              </button>
            </div>
          </Section>

          {!isTerminal&&canMoveCandidate&&(
            <Section icon={<CheckCircle2 size={13}/>} title="Update Application Status">
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <select value={selectedStatus} onChange={e=>setSelectedStatus(e.target.value)}
                  style={{width:'100%',border:'1px solid #E2E8F0',borderRadius:10,padding:'10px 12px',fontSize:13,background:'#fff',color:'#1E293B',outline:'none'}}>
                  <option value="">Select new status…</option>
                  {STATUS_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {selectedStatus&&(
                  <textarea value={statusNote} onChange={e=>setStatusNote(e.target.value)} placeholder="Note to candidate (optional)..." rows={2} maxLength={500}
                    style={{width:'100%',border:'1px solid #E2E8F0',borderRadius:10,padding:'10px 12px',fontSize:13,resize:'none',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                )}
                <button onClick={()=>updateMutation.mutate()} disabled={!selectedStatus||updateMutation.isPending}
                  style={{padding:11,borderRadius:10,border:'none',fontSize:13,fontWeight:700,background:selectedStatus?(STATUS_OPTIONS.find(o=>o.value===selectedStatus)?.color??'#3B82F6'):'#E2E8F0',color:selectedStatus?'#fff':'#94A3B8',cursor:(!selectedStatus||updateMutation.isPending)?'not-allowed':'pointer'}}>
                  {updateMutation.isPending?'Saving…':selectedStatus?`Confirm: ${STATUS_OPTIONS.find(o=>o.value===selectedStatus)?.label}`:'Select a status above'}
                </button>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Candidate Card ────────────────────────────────────────────────────────────

function CandidateCard({candidate,jobId,selected,onSelect}:{candidate:CandidateOut;jobId:string;selected:boolean;onSelect:(id:string)=>void}){
  const [drawerOpen,setDrawerOpen]=useState(false)
  const st=STATUS_STYLE[candidate.status]??{bg:'#F3F4F6',text:'#6B7280'}

  return(
    <>
      <div style={{background:'#fff',borderRadius:16,border:selected?'2px solid #3B82F6':'1px solid #E5E7EB',padding:'16px 18px',cursor:'pointer',transition:'all 0.18s',boxShadow:selected?'0 0 0 3px rgba(59,130,246,0.1)':'0 2px 8px rgba(0,0,0,0.03)'}}
        onClick={()=>setDrawerOpen(true)}
        onMouseOver={e=>{if(!selected)e.currentTarget.style.borderColor='#CBD5E1'}}
        onMouseOut={e=>{if(!selected)e.currentTarget.style.borderColor='#E5E7EB'}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
          <input type="checkbox" checked={selected} onChange={e=>{e.stopPropagation();onSelect(candidate.application_id)}} onClick={e=>e.stopPropagation()}
            style={{marginTop:3,accentColor:'#3B82F6',flexShrink:0,width:15,height:15}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
              <h3 style={{fontSize:14,fontWeight:700,color:'#0F172A',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{candidate.full_name??'Anonymous'}</h3>
              <span style={{padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,background:st.bg,color:st.text,flexShrink:0,textTransform:'capitalize'}}>{candidate.status.replace('_',' ')}</span>
            </div>
            <p style={{fontSize:11,color:'#64748B',marginTop:2}}>
              {[candidate.city,candidate.state].filter(Boolean).join(', ')||'Location N/A'}
              {candidate.last_designation?` · ${candidate.last_designation}`:''}
            </p>
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
          {candidate.match_score!==null&&<StatChip label="Match" value={`${candidate.match_score}%`} color={candidate.match_score>=70?'#059669':candidate.match_score>=40?'#D97706':'#DC2626'}/>}
          {candidate.composite!==null&&<StatChip label="KRS" value={String(candidate.composite)} color="#7C3AED"/>}
          {candidate.upsc_attempts!==null&&<StatChip label="Attempts" value={String(candidate.upsc_attempts)} color="#3B82F6"/>}
        </div>
        {candidate.skills.length>0&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {candidate.skills.slice(0,4).map(s=>(
              <span key={s} style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,background:'rgba(59,130,246,0.07)',color:'#3B82F6',border:'1px solid rgba(59,130,246,0.12)'}}>{s}</span>
            ))}
            {candidate.skills.length>4&&<span style={{fontSize:10,color:'#94A3B8',padding:'2px 0'}}>+{candidate.skills.length-4}</span>}
          </div>
        )}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12,paddingTop:10,borderTop:'1px solid #F1F5F9'}}>
          <span style={{fontSize:11,color:'#94A3B8'}}>{candidate.days_ago===0?'Applied today':`Applied ${candidate.days_ago}d ago`}</span>
          <span style={{fontSize:11,color:'#3B82F6',fontWeight:600}}>View full profile →</span>
        </div>
      </div>
      {drawerOpen&&<ProfileDrawer candidate={candidate} jobId={jobId} onClose={()=>setDrawerOpen(false)}/>}
    </>
  )
}

// ── Kanban Board ──────────────────────────────────────────────────────────────

function KanbanCard({ candidate, jobId, onDragStart }: {
  candidate: CandidateOut; jobId: string; onDragStart: (id: string) => void
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  return (
    <>
      <div
        draggable
        onDragStart={() => onDragStart(candidate.application_id)}
        onClick={() => setDrawerOpen(true)}
        style={{
          background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
          padding: '12px 14px', marginBottom: 10, cursor: 'grab',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{candidate.full_name ?? 'Anonymous'}</p>
        <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 8px' }}>
          {[candidate.city, candidate.state].filter(Boolean).join(', ') || 'Location N/A'}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {candidate.match_score !== null && <StatChip label="Match" value={`${candidate.match_score}%`} color={candidate.match_score >= 70 ? '#059669' : candidate.match_score >= 40 ? '#D97706' : '#DC2626'} />}
          {candidate.avg_rating !== null && <StatChip label="★" value={candidate.avg_rating.toFixed(1)} color="#D97706" />}
        </div>
      </div>
      {drawerOpen && <ProfileDrawer candidate={candidate} jobId={jobId} onClose={() => setDrawerOpen(false)} />}
    </>
  )
}

function KanbanBoard({ candidates, jobId, stages, onMove }: {
  candidates: CandidateOut[]; jobId: string; stages: PipelineStage[]
  onMove: (applicationId: string, toStatus: string) => void
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  const visibleStages = useMemo(
    () => [...stages].filter(s => s.is_visible).sort((a, b) => a.position - b.position),
    [stages]
  )

  const byStage = useMemo(() => {
    const map = new Map<string, CandidateOut[]>()
    visibleStages.forEach(s => map.set(s.stage_key, []))
    candidates.forEach(c => {
      const key = c.status === 'under_review' ? 'screening' : c.status
      if (map.has(key)) map.get(key)!.push(c)
    })
    return map
  }, [candidates, visibleStages])

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
      {visibleStages.map(stage => {
        const items = byStage.get(stage.stage_key) ?? []
        const isDragOver = dragOverStage === stage.stage_key
        return (
          <div
            key={stage.stage_key}
            onDragOver={e => { e.preventDefault(); setDragOverStage(stage.stage_key) }}
            onDragLeave={() => setDragOverStage(prev => prev === stage.stage_key ? null : prev)}
            onDrop={e => {
              e.preventDefault()
              if (draggingId) onMove(draggingId, stage.stage_key)
              setDraggingId(null)
              setDragOverStage(null)
            }}
            style={{
              minWidth: 260, flexShrink: 0, borderRadius: 14,
              background: isDragOver ? `${stage.color}0a` : '#F1F5F9',
              border: isDragOver ? `2px dashed ${stage.color}` : '1px solid #E5E7EB',
              padding: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{stage.display_name}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', background: '#fff', borderRadius: 20, padding: '1px 8px' }}>{items.length}</span>
            </div>
            {items.length === 0 ? (
              <p style={{ fontSize: 11, color: '#CBD5E1', textAlign: 'center', padding: '20px 0' }}>No candidates</p>
            ) : (
              items.map(c => (
                <KanbanCard key={c.application_id} candidate={c} jobId={jobId} onDragStart={setDraggingId} />
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Manage Stages Modal ───────────────────────────────────────────────────────

const COLOUR_PRESETS = [
  '#3B82F6','#6366F1','#8B5CF6','#EC4899','#EF4444',
  '#F97316','#EAB308','#22C55E','#14B8A6','#0EA5E9',
  '#64748B','#1E3A5F',
]

const STAGE_KEY_OPTIONS = [
  { key: 'applied',             label: 'Applied'       },
  { key: 'screening',           label: 'Screening'     },
  { key: 'shortlisted',         label: 'Shortlisted'   },
  { key: 'interview_scheduled', label: 'Interview'     },
  { key: 'interview_completed', label: 'Interviewed'   },
  { key: 'offer_sent',          label: 'Offer Sent'    },
  { key: 'hired',               label: 'Hired'         },
  { key: 'rejected',            label: 'Rejected'      },
]

function ManageStagesModal({ jobId, stages, onClose }: {
  jobId: string; stages: PipelineStage[]; onClose: () => void
}) {
  const [localStages, setLocalStages] = useState<PipelineStage[]>(
    [...stages].sort((a, b) => a.position - b.position)
  )
  const [saveAsTemplateName, setSaveAsTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [applyTemplateId, setApplyTemplateId] = useState('')

  const save           = useBulkUpsertPipelineStages(jobId)
  const createTemplate = useCreatePipelineTemplate()
  const deleteTemplate = useDeletePipelineTemplate()
  const applyTemplate  = useApplyTemplateToJob(jobId)
  const { data: templates = [] } = usePipelineTemplates()

  const update = (idx: number, patch: Partial<PipelineStage>) =>
    setLocalStages(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...localStages]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setLocalStages(next.map((s, i) => ({ ...s, position: i })))
  }

  const handleSave = () => {
    save.mutate(localStages.map((s, i) => ({ ...s, position: i })), { onSuccess: onClose })
  }

  const handleSaveAsTemplate = () => {
    if (!saveAsTemplateName.trim()) return
    createTemplate.mutate(
      { name: saveAsTemplateName.trim(), stages: localStages.map((s, i) => ({ ...s, position: i })) },
      { onSuccess: () => { setSaveAsTemplateName(''); setShowSaveTemplate(false) } }
    )
  }

  const handleApplyTemplate = () => {
    if (!applyTemplateId) return
    applyTemplate.mutate(applyTemplateId, {
      onSuccess: (newStages) => {
        setLocalStages([...newStages].sort((a, b) => a.position - b.position))
        setApplyTemplateId('')
      },
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #F1F5F9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0, fontFamily: 'Hind, sans-serif' }}>Manage Pipeline Stages</h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Rename, recolour, and reorder stages for this job.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 24px' }}>

          {/* Template toolbar */}
          {templates.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={applyTemplateId}
                onChange={e => setApplyTemplateId(e.target.value)}
                style={{ height: 34, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 12, color: '#374151', flex: 1 }}
              >
                <option value="">Load a template…</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button
                onClick={handleApplyTemplate}
                disabled={!applyTemplateId || applyTemplate.isPending}
                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: applyTemplateId ? '#3B82F6' : '#E5E7EB', color: applyTemplateId ? '#fff' : '#94A3B8', fontSize: 12, fontWeight: 700, cursor: applyTemplateId ? 'pointer' : 'not-allowed' }}
              >Apply</button>
              {templates.map(t => (
                <button key={t.id} onClick={() => deleteTemplate.mutate(t.id)} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 11, cursor: 'pointer' }}>
                  Delete "{t.name}"
                </button>
              ))}
            </div>
          )}

          {/* Stage rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {localStages.map((stage, idx) => (
              <div key={stage.stage_key} style={{
                display: 'grid', gridTemplateColumns: '24px 1fr 110px 56px 60px', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F1F5F9', background: stage.is_visible ? '#FAFAFA' : '#F8FAFC',
              }}>
                {/* Drag handle / reorder */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, cursor: 'pointer', color: '#CBD5E1' }}>
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#E5E7EB' : '#94A3B8', padding: 0, lineHeight: 1 }}>▲</button>
                  <button onClick={() => move(idx, 1)}  disabled={idx === localStages.length - 1} style={{ background: 'none', border: 'none', cursor: idx === localStages.length - 1 ? 'not-allowed' : 'pointer', color: idx === localStages.length - 1 ? '#E5E7EB' : '#94A3B8', padding: 0, lineHeight: 1 }}>▼</button>
                </div>

                {/* Display name */}
                <input
                  value={stage.display_name}
                  onChange={e => update(idx, { display_name: e.target.value })}
                  style={{ height: 34, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 13, color: '#1E293B', background: '#fff', outline: 'none' }}
                />

                {/* Colour picker swatches */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {COLOUR_PRESETS.map(c => (
                    <button
                      key={c}
                      onClick={() => update(idx, { color: c })}
                      style={{
                        width: 16, height: 16, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                        outline: stage.color === c ? `2px solid ${c}` : 'none',
                        outlineOffset: 1,
                      }}
                    />
                  ))}
                </div>

                {/* Visibility toggle */}
                <button
                  onClick={() => update(idx, { is_visible: !stage.is_visible })}
                  style={{
                    height: 28, borderRadius: 8, border: `1.5px solid ${stage.is_visible ? '#BBF7D0' : '#E5E7EB'}`,
                    background: stage.is_visible ? '#F0FDF4' : '#F9FAFB',
                    color: stage.is_visible ? '#059669' : '#9CA3AF',
                    fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: '0 8px',
                  }}
                >{stage.is_visible ? 'Visible' : 'Hidden'}</button>

                {/* Colour preview chip */}
                <span style={{
                  height: 24, padding: '0 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
                }}>{stage.stage_key.split('_')[0]}</span>
              </div>
            ))}
          </div>

          {/* Save as template */}
          {!showSaveTemplate ? (
            <button onClick={() => setShowSaveTemplate(true)} style={{ fontSize: 12, color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, marginBottom: 16 }}>
              + Save current layout as template
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={saveAsTemplateName}
                onChange={e => setSaveAsTemplateName(e.target.value)}
                placeholder="Template name…"
                style={{ flex: 1, height: 34, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 13, outline: 'none' }}
              />
              <button onClick={handleSaveAsTemplate} disabled={createTemplate.isPending}
                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: '#6366F1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Save
              </button>
              <button onClick={() => setShowSaveTemplate(false)} style={{ height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 38, padding: '0 20px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancel</button>
          <button onClick={handleSave} disabled={save.isPending} style={{ height: 38, padding: '0 24px', borderRadius: 10, border: 'none', background: '#1E293B', color: '#fff', fontSize: 13, fontWeight: 700, cursor: save.isPending ? 'not-allowed' : 'pointer' }}>
            {save.isPending ? 'Saving…' : 'Save Stages'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CandidatePipelinePage() {
  const {jobId}=useParams<{jobId:string}>()
  const qc=useQueryClient()

  const [statusFilter,setStatusFilter]=useState('all')
  const [searchQuery,setSearchQuery]=useState('')
  const [sortBy,setSortBy]=useState('match_score')
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set())
  const [bulkStatus,setBulkStatus]=useState('')
  const [bulkNote,setBulkNote]=useState('')
  const [showBulkEmail,setShowBulkEmail]=useState(false)
  const [bulkEmailSubject,setBulkEmailSubject]=useState('')
  const [bulkEmailBody,setBulkEmailBody]=useState('')
  const [showFilters,setShowFilters]=useState(false)
  const [minKrs,setMinKrs]=useState(0)
  const [view,setView]=useState<'list'|'kanban'>('kanban')
  const [showManageStages,setShowManageStages]=useState(false)
  const canMoveCandidates=useHasPermission('candidates:shortlist')

  const { data: pipelineStages } = usePipelineStages(jobId ?? '')
  const activeStages = pipelineStages && pipelineStages.length > 0 ? pipelineStages : DEFAULT_KANBAN_STAGES

  const {data:pipeline,isLoading,isError}=useQuery({
    queryKey:['pipeline',jobId],
    queryFn:()=>getJobPipeline(jobId!),
    enabled:!!jobId,
  })

  const bulkMutation=useMutation({
    mutationFn:()=>bulkUpdateApplicationStatus([...selectedIds],bulkStatus,bulkNote||undefined),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['pipeline',jobId]});setSelectedIds(new Set());setBulkStatus('');setBulkNote('')},
  })

  const bulkEmailMutation=useMutation({
    mutationFn:()=>bulkEmailCandidates([...selectedIds],bulkEmailSubject,bulkEmailBody),
    onSuccess:()=>{setShowBulkEmail(false);setBulkEmailSubject('');setBulkEmailBody('')},
  })

  const moveMutation=useMutation({
    mutationFn:({id,status}:{id:string;status:string})=>updateApplicationStatus(id,status),
    onSuccess:()=>qc.invalidateQueries({queryKey:['pipeline',jobId]}),
  })

  const filtered=useMemo(()=>{
    if(!pipeline)return[]
    let list=pipeline.candidates
    if(statusFilter!=='all')list=list.filter(c=>c.status===statusFilter)
    if(searchQuery.trim()){
      const q=searchQuery.toLowerCase()
      list=list.filter(c=>(c.full_name??'').toLowerCase().includes(q)||(c.skills??[]).some(s=>s.toLowerCase().includes(q))||(c.work_experience_domain??'').toLowerCase().includes(q)||(c.last_designation??'').toLowerCase().includes(q))
    }
    if(minKrs>0)list=list.filter(c=>(c.composite??0)>=minKrs)
    return[...list].sort((a,b)=>{
      if(sortBy==='match_score')return(b.match_score??0)-(a.match_score??0)
      if(sortBy==='krs')return(b.composite??0)-(a.composite??0)
      if(sortBy==='applied_at')return a.days_ago-b.days_ago
      return 0
    })
  },[pipeline,statusFilter,searchQuery,sortBy,minKrs])

  const toggleSelect=(id:string)=>{
    setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  }
  const toggleSelectAll=()=>{
    setSelectedIds(selectedIds.size===filtered.length&&filtered.length>0?new Set():new Set(filtered.map(c=>c.application_id)))
  }

  if(isLoading)return(
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:36,height:36,border:'3px solid rgba(59,130,246,0.2)',borderTopColor:'#3B82F6',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if(isError||!pipeline)return(
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#DC2626',gap:8}}>
      <AlertCircle size={20}/>Failed to load candidate pipeline.
    </div>
  )

  return(
    <div style={{flex:1,background:'#F8FAFC'}}>
      {/* Top bar */}
      <header style={{background:'#fff',borderBottom:'1px solid #E5E7EB',padding:'0 28px',height:60,display:'flex',alignItems:'center',gap:16,position:'sticky',top:0,zIndex:30,boxShadow:'0 1px 8px rgba(0,0,0,0.04)'}}>
        <Link to="/app/employer" style={{color:'#64748B',textDecoration:'none',display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600}}>
          <ArrowLeft size={14}/>Back
        </Link>
        <div style={{width:1,height:24,background:'#E5E7EB'}}/>
        <div style={{flex:1}}>
          <h1 style={{fontSize:16,fontWeight:800,color:'#0F172A',margin:0}}>{pipeline.job_title}</h1>
          <p style={{fontSize:11,color:'#94A3B8',margin:0}}>{pipeline.total_applications} total application{pipeline.total_applications!==1?'s':''}</p>
        </div>
        <div style={{display:'flex',gap:2,background:'#F1F5F9',borderRadius:10,padding:2}}>
          <button onClick={()=>setView('kanban')} title="Kanban view"
            style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,border:'none',background:view==='kanban'?'#fff':'transparent',boxShadow:view==='kanban'?'0 1px 3px rgba(0,0,0,0.08)':'none',fontSize:12,fontWeight:700,color:view==='kanban'?'#0F172A':'#94A3B8',cursor:'pointer'}}>
            <LayoutGrid size={13}/>Kanban
          </button>
          <button onClick={()=>setView('list')} title="List view"
            style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,border:'none',background:view==='list'?'#fff':'transparent',boxShadow:view==='list'?'0 1px 3px rgba(0,0,0,0.08)':'none',fontSize:12,fontWeight:700,color:view==='list'?'#0F172A':'#94A3B8',cursor:'pointer'}}>
            <ListIcon size={13}/>List
          </button>
        </div>
        <button onClick={()=>setShowManageStages(true)}
          style={{display:'flex',alignItems:'center',gap:7,padding:'8px 14px',borderRadius:10,border:'1px solid rgba(99,102,241,0.3)',background:'rgba(99,102,241,0.06)',fontSize:12,fontWeight:700,color:'#6366F1',cursor:'pointer'}}>
          <Settings2 size={13}/>Stages
        </button>
        <button onClick={()=>exportToCSV(filtered,pipeline.job_title)}
          style={{display:'flex',alignItems:'center',gap:7,padding:'8px 14px',borderRadius:10,border:'1px solid #E5E7EB',background:'#fff',fontSize:12,fontWeight:700,color:'#374151',cursor:'pointer'}}>
          <Download size={13}/>Export CSV
        </button>
      </header>
      {showManageStages&&jobId&&<ManageStagesModal jobId={jobId} stages={activeStages} onClose={()=>setShowManageStages(false)}/>}

      <div style={{maxWidth:1100,margin:'0 auto',padding:24}}>
        {/* Status tabs */}
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
          <FilterTab label={`All (${pipeline.total_applications})`} active={statusFilter==='all'} onClick={()=>setStatusFilter('all')}/>
          {Object.entries(pipeline.by_status).map(([s,count])=>{
            const stageName = activeStages.find(st => st.stage_key === s)?.display_name ?? s.replace(/_/g,' ')
            return <FilterTab key={s} label={`${stageName} (${count})`} active={statusFilter===s} onClick={()=>setStatusFilter(s)}/>
          })}
        </div>

        {/* Search + Sort */}
        <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200,position:'relative'}}>
            <Search size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94A3B8'}}/>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search by name, skill, or domain…"
              style={{width:'100%',height:38,paddingLeft:34,paddingRight:12,border:'1px solid #E5E7EB',borderRadius:10,fontSize:13,background:'#fff',color:'#0F172A',outline:'none',boxSizing:'border-box'}}/>
          </div>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{height:38,padding:'0 12px',border:'1px solid #E5E7EB',borderRadius:10,fontSize:13,background:'#fff',color:'#374151',cursor:'pointer'}}>
            {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={()=>setShowFilters(!showFilters)} style={{height:38,padding:'0 14px',border:'1px solid #E5E7EB',borderRadius:10,fontSize:12,fontWeight:600,background:showFilters?'#1E293B':'#fff',color:showFilters?'#fff':'#374151',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            <SlidersHorizontal size={13}/>Filters{showFilters?<ChevronUp size={11}/>:<ChevronDown size={11}/>}
          </button>
        </div>

        {/* Advanced filters */}
        {showFilters&&(
          <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:12,padding:'14px 18px',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#64748B',whiteSpace:'nowrap'}}>Min KRS Score:</label>
              <input type="range" min={0} max={100} step={5} value={minKrs} onChange={e=>setMinKrs(Number(e.target.value))} style={{flex:1}}/>
              <span style={{fontSize:13,fontWeight:700,color:'#7C3AED',minWidth:30}}>{minKrs}</span>
              {minKrs>0&&<button onClick={()=>setMinKrs(0)} style={{fontSize:11,color:'#94A3B8',border:'none',background:'none',cursor:'pointer'}}>Reset</button>}
            </div>
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size>0&&canMoveCandidates&&(
          <div style={{background:'#1E293B',borderRadius:12,padding:'12px 18px',display:'flex',alignItems:'center',gap:12,marginBottom:14,flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:700,color:'#fff'}}>{selectedIds.size} selected</span>
            <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)} style={{height:32,padding:'0 10px',borderRadius:8,border:'none',fontSize:12,background:'#334155',color:'#fff',cursor:'pointer'}}>
              <option value="">Bulk action…</option>
              {STATUS_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {bulkStatus&&<input value={bulkNote} onChange={e=>setBulkNote(e.target.value)} placeholder="Optional note…" style={{height:32,padding:'0 10px',borderRadius:8,border:'none',fontSize:12,background:'#334155',color:'#fff',minWidth:180}}/>}
            <button onClick={()=>bulkMutation.mutate()} disabled={!bulkStatus||bulkMutation.isPending} style={{height:32,padding:'0 14px',borderRadius:8,border:'none',background:'#3B82F6',color:'#fff',fontSize:12,fontWeight:700,cursor:(!bulkStatus||bulkMutation.isPending)?'not-allowed':'pointer',opacity:!bulkStatus?0.5:1}}>
              {bulkMutation.isPending?'Applying…':'Apply'}
            </button>
            <button onClick={()=>setShowBulkEmail(true)} style={{height:32,padding:'0 14px',borderRadius:8,border:'none',background:'#0EA5E9',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
              <Mail size={13}/>Email All
            </button>
            <button onClick={()=>setSelectedIds(new Set())} style={{height:32,padding:'0 12px',borderRadius:8,border:'1px solid #475569',background:'none',color:'#94A3B8',fontSize:12,cursor:'pointer'}}>Cancel</button>
          </div>
        )}

        {/* Bulk email modal */}
        {showBulkEmail&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:16}}>
            <div style={{background:'#fff',borderRadius:18,padding:28,width:'100%',maxWidth:480,display:'flex',flexDirection:'column',gap:16}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <h3 style={{margin:0,fontSize:16,fontWeight:800,color:'#0F172A'}}>Email {selectedIds.size} candidate{selectedIds.size!==1?'s':''}</h3>
                  <p style={{margin:'4px 0 0',fontSize:12,color:'#94A3B8'}}>Each candidate receives a separate copy of this email.</p>
                </div>
                <button onClick={()=>setShowBulkEmail(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',padding:4}}>
                  <X size={18}/>
                </button>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <input
                  value={bulkEmailSubject}
                  onChange={e=>setBulkEmailSubject(e.target.value)}
                  placeholder="Subject…"
                  maxLength={255}
                  style={{height:38,padding:'0 12px',borderRadius:10,border:'1px solid #E5E7EB',fontSize:13,outline:'none'}}
                />
                <textarea
                  value={bulkEmailBody}
                  onChange={e=>setBulkEmailBody(e.target.value)}
                  placeholder="Write your message…"
                  rows={6}
                  maxLength={10000}
                  style={{padding:'10px 12px',borderRadius:10,border:'1px solid #E5E7EB',fontSize:13,resize:'vertical',outline:'none',fontFamily:'inherit'}}
                />
              </div>
              {bulkEmailMutation.isError&&(
                <p style={{fontSize:12,color:'#DC2626',margin:0}}>{String(bulkEmailMutation.error)}</p>
              )}
              {bulkEmailMutation.isSuccess&&(
                <p style={{fontSize:12,color:'#059669',margin:0}}>
                  ✓ Sent to {(bulkEmailMutation.data as {sent:number;skipped:number}).sent} candidate{(bulkEmailMutation.data as {sent:number;skipped:number}).sent!==1?'s':''}
                  {(bulkEmailMutation.data as {sent:number;skipped:number}).skipped>0&&` · ${(bulkEmailMutation.data as {sent:number;skipped:number}).skipped} skipped (no email on file)`}
                </p>
              )}
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setShowBulkEmail(false)} style={{flex:1,height:40,borderRadius:10,border:'1px solid #E5E7EB',background:'none',fontSize:13,fontWeight:600,color:'#6B7280',cursor:'pointer'}}>Cancel</button>
                <button
                  onClick={()=>bulkEmailMutation.mutate()}
                  disabled={!bulkEmailSubject.trim()||!bulkEmailBody.trim()||bulkEmailMutation.isPending}
                  style={{flex:1,height:40,borderRadius:10,border:'none',background:(!bulkEmailSubject.trim()||!bulkEmailBody.trim())?'#E2E8F0':'#0EA5E9',color:(!bulkEmailSubject.trim()||!bulkEmailBody.trim())?'#94A3B8':'#fff',fontSize:13,fontWeight:700,cursor:(!bulkEmailSubject.trim()||!bulkEmailBody.trim()||bulkEmailMutation.isPending)?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}
                >
                  <Send size={13}/>{bulkEmailMutation.isPending?'Sending…':'Send Email'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Select all */}
        {filtered.length>0&&canMoveCandidates&&(
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <input type="checkbox" checked={selectedIds.size===filtered.length&&filtered.length>0} onChange={toggleSelectAll} style={{accentColor:'#3B82F6',width:15,height:15}}/>
            <span style={{fontSize:12,color:'#64748B'}}>
              {selectedIds.size===filtered.length&&filtered.length>0?'Deselect all':'Select all'} ({filtered.length})
            </span>
          </div>
        )}

        {/* Kanban or Grid */}
        {filtered.length===0?(
          <div style={{textAlign:'center',padding:'60px 24px',color:'#94A3B8'}}>
            <Users size={40} style={{margin:'0 auto 12px',opacity:0.3,display:'block'}}/>
            <p style={{fontSize:15,fontWeight:600,margin:'0 0 4px'}}>No candidates found</p>
            <p style={{fontSize:13,margin:0}}>Try adjusting your filters or search.</p>
          </div>
        ):view==='kanban'?(
          <KanbanBoard
            candidates={filtered}
            jobId={jobId!}
            stages={activeStages}
            onMove={canMoveCandidates?(applicationId,toStatus)=>moveMutation.mutate({id:applicationId,status:toStatus}):()=>{}}
          />
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:14}}>
            {filtered.map(c=>(
              <CandidateCard key={c.application_id} candidate={c} jobId={jobId!} selected={selectedIds.has(c.application_id)} onSelect={toggleSelect}/>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
