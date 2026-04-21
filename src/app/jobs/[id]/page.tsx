'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Candidate, CandidateStatus, Job, Note } from '@/lib/types'
import { logActivityAuto } from '@/lib/audit'
import { useImpersonation } from '@/lib/contexts/impersonation-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { ArrowLeft, Search, Plus, MoreHorizontal, Mail, Phone, ExternalLink , FileText, Trash2, Edit2, GripVertical } from 'lucide-react'
import Link from 'next/link'
import CandidateModal from '@/components/candidate-modal'

const STATUS_COLUMNS: { status: CandidateStatus; label: string; color: string; border: string }[] = [
  { status: 'applied', label: 'Applied', color: 'bg-blue-500/10 text-blue-600', border: 'border-blue-500/20' },
  { status: 'screening', label: 'Screening', color: 'bg-amber-500/10 text-amber-600', border: 'border-amber-500/20' },
  { status: 'interview', label: 'Interview', color: 'bg-purple-500/10 text-purple-600', border: 'border-purple-500/20' },
  { status: 'offered', label: 'Offered', color: 'bg-emerald-500/10 text-emerald-600', border: 'border-emerald-500/20' },
  { status: 'rejected', label: 'Rejected', color: 'bg-destructive/10 text-destructive', border: 'border-destructive/20' },
]

export default function JobCandidatesKanbanPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  
  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<(Candidate & { notes?: Note[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null)
  
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [candidateNotes, setCandidateNotes] = useState<Note[]>([])
  
  const [newNote, setNewNote] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  
  const supabase = createClient()
  const { impersonating, data: impData } = useImpersonation()

  useEffect(() => {
    setIsMounted(true)
    loadJob()
    loadCandidates()
  }, [jobId])

  async function loadJob() {
    const { data } = await supabase
      .from('jobs')
      .select('*, customer:profiles(*)')
      .eq('id', jobId)
      .single()
    setJob(data)
  }

  async function loadCandidates() {
    setLoading(true)
    const { data } = await supabase
      .from('candidates')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
    setCandidates(data || [])
    setLoading(false)
  }

  async function loadCandidateNotes(candidateId: string) {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
    setCandidateNotes(data || [])
  }

  function handleAddClick() {
    setEditingCandidate(null)
    setIsModalOpen(true)
  }

  function handleEditClick(candidate: Candidate) {
    setEditingCandidate(candidate)
    setIsModalOpen(true)
  }

  async function handleDeleteCandidate(id: string) {
    if (!confirm('Are you sure you want to delete this candidate?')) return
    const candidateName = candidates.find(c => c.id === id)?.full_name
    try {
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) throw error
      await logActivityAuto(supabase, {
        action: 'delete',
        entityType: 'candidate',
        entityId: id,
        entityName: candidateName,
        companyId: job?.company_id,
        impersonating,
        impersonatedId: impData?.userId,
        impersonatedName: impData?.userName,
      })
      loadCandidates()
      setIsNotesDialogOpen(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete candidate')
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return

    const { source, destination, draggableId } = result
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const oldStatus = source.droppableId as CandidateStatus
    const newStatus = destination.droppableId as CandidateStatus
    const movedCandidate = candidates.find(c => c.id === draggableId)

    // Optimistic UI update
    setCandidates((prev) => 
      prev.map(c => c.id === draggableId ? { ...c, status: newStatus } : c)
    )

    try {
      const { error } = await supabase
        .from('candidates')
        .update({ status: newStatus })
        .eq('id', draggableId)

      if (error) throw error

      await logActivityAuto(supabase, {
        action: 'stage_change',
        entityType: 'candidate',
        entityId: draggableId,
        entityName: movedCandidate?.full_name,
        oldValue: { status: oldStatus },
        newValue: { status: newStatus },
        companyId: job?.company_id,
        impersonating,
        impersonatedId: impData?.userId,
        impersonatedName: impData?.userName,
      })
    } catch (error) {
      loadCandidates() // revert
      alert('Failed to update applicant stage')
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || !selectedCandidate) return
    try {
      const { error } = await supabase.from('notes').insert([{ candidate_id: selectedCandidate.id, content: newNote.trim() }])
      if (error) throw error
      await logActivityAuto(supabase, {
        action: 'note_added',
        entityType: 'note',
        entityId: selectedCandidate.id,
        entityName: selectedCandidate.full_name,
        newValue: { preview: newNote.trim().substring(0, 80) },
        companyId: job?.company_id,
        impersonating,
        impersonatedId: impData?.userId,
        impersonatedName: impData?.userName,
      })
      setNewNote('')
      loadCandidateNotes(selectedCandidate.id)
    } catch (error) {
      alert('Failed to add note')
    }
  }

  function openNotesDialog(candidate: Candidate) {
    setSelectedCandidate(candidate)
    setIsNotesDialogOpen(true)
    loadCandidateNotes(candidate.id)
  }

  const filteredCandidates = candidates.filter(candidate =>
    candidate.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isMounted) return null

  return (
    <div className="flex flex-col h-[calc(100vh-2px)] max-h-screen bg-background overflow-hidden p-6 md:p-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/jobs')} className="rounded-full bg-muted/50 hover:bg-muted shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate max-w-sm md:max-w-md">{job?.title || 'Loading Board...'}</h1>
            {job && <p className="text-muted-foreground text-sm flex items-center gap-2 mt-0.5">{job.job_type} • {job.location || 'Remote'}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search board..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 w-full bg-muted/30 border-transparent shadow-sm"
            />
          </div>
          
          <Button onClick={handleAddClick} className="h-10 shadow-sm shrink-0">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Candidate
          </Button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 snap-x">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-5 items-start px-1 min-w-max">
              {STATUS_COLUMNS.map((column) => {
                const columnCandidates = filteredCandidates.filter((c) => c.status === column.status)

                return (
                  <div key={column.status} className="flex flex-col w-[320px] max-h-full shrink-0 snap-center">
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-3 px-1 mt-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${column.color}`}>
                          {column.label}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground bg-muted w-6 h-6 rounded-full flex items-center justify-center">
                          {columnCandidates.length}
                        </span>
                      </div>
                    </div>

                    {/* Column Droppable Area */}
                    <Droppable droppableId={column.status}>
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={`flex-1 overflow-y-auto p-2.5 rounded-xl bg-muted/30 border border-border/40 min-h-[150px] flex flex-col gap-3 transition-colors ${
                            snapshot.isDraggingOver ? 'bg-muted/60 border-primary/30 ring-1 ring-primary/20' : ''
                          }`}
                        >
                          {columnCandidates.map((candidate, index) => (
                            <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    opacity: snapshot.isDragging ? 0.9 : 1,
                                  }}
                                >
                                  <Card className={`group relative bg-card shadow-sm hover:shadow-md transition-all duration-200 border-l-4 ${column.border.replace('border-', 'border-l-')} ${snapshot.isDragging ? 'ring-2 ring-primary/40 shadow-xl scale-[1.02] cursor-grabbing' : 'cursor-grab'} !rounded-lg`}>
                                    <CardContent className="p-4">
                                      <div className="flex justify-between items-start mb-3">
                                         <div className="flex items-center gap-2.5">
                                           <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
                                              {candidate.full_name.charAt(0).toUpperCase()}
                                           </div>
                                           <div>
                                             <h4 className="text-sm font-semibold text-foreground line-clamp-1 leading-tight">{candidate.full_name}</h4>
                                             <p className="text-xs text-muted-foreground line-clamp-1">{job?.title}</p>
                                           </div>
                                         </div>
                                         <div className="flex bg-muted/50 rounded-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:bg-background hover:text-foreground rounded-sm" onClick={(e) => { e.stopPropagation(); handleEditClick(candidate) }}>
                                             <Edit2 className="w-3.5 h-3.5" />
                                           </Button>
                                           <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:bg-background hover:text-foreground rounded-sm" onClick={(e) => { e.stopPropagation(); openNotesDialog(candidate) }}>
                                             <MoreHorizontal className="w-3.5 h-3.5" />
                                           </Button>
                                         </div>
                                      </div>

                                      <div className="flex flex-col gap-1.5 mb-4">
                                        <div className="flex items-center text-[11px] text-muted-foreground gap-2">
                                          <Mail className="w-3 h-3 text-muted-foreground/70" />
                                          <span className="truncate">{candidate.email}</span>
                                        </div>
                                        {(candidate.resume_url || candidate.phone) && (
                                          <div className="flex items-center text-[11px] text-muted-foreground gap-2">
                                            {candidate.resume_url ? (
                                                <a href={candidate.resume_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors truncate" onClick={e => e.stopPropagation()}>
                                                    <ExternalLink className="w-3 h-3 text-[#0a66c2]" /> Resume
                                                </a>
                                            ) : (
                                                <><Phone className="w-3 h-3 text-muted-foreground/70" /> <span>{candidate.phone}</span></>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                         <div className="flex gap-1.5">
                                            <Button variant="secondary" size="sm" className="h-7 text-[10px] px-2 bg-muted/50 hover:bg-muted" onClick={() => openNotesDialog(candidate)}>
                                              <FileText className="w-3 h-3 mr-1.5 text-muted-foreground" /> Notes
                                            </Button>
                                         </div>
                                         <div className="text-[10px] text-muted-foreground font-medium flex items-center">
                                            <GripVertical className="w-3 h-3 mr-0.5 opacity-40" /> Drag
                                         </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Candidate Notes Dialog (Slide-over style optionally) */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl">{selectedCandidate?.full_name}</DialogTitle>
                <DialogDescription className="mt-1">
                  Applicant for {job?.title}
                </DialogDescription>
              </div>
              <Button variant="destructive" size="icon" className="h-8 w-8 ml-auto" onClick={() => selectedCandidate && handleDeleteCandidate(selectedCandidate.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-3 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {candidateNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2 opacity-60">
                   <FileText className="w-8 h-8" />
                   <p className="text-sm">No notes recorded yet</p>
                </div>
              ) : (
                candidateNotes.map((note) => (
                  <div key={note.id} className="bg-muted/40 p-4 rounded-xl border border-border/50 relative group">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-3 font-medium">
                      {new Date(note.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                ))
              )}
            </div>
            
            <div className="pt-2">
              <div className="flex flex-col gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Record interview feedback or internal notes..."
                  className="w-full px-3 py-2 border border-border/50 bg-muted/20 rounded-xl min-h-[80px] text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleAddNote()
                    }
                  }}
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-muted-foreground">Press Cmd/Ctrl + Enter to send</span>
                  <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()}>Add Note</Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <CandidateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadCandidates}
        candidate={editingCandidate}
        preselectedJobId={jobId}
      />
    </div>
  )
}