"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/authClient";

interface Candidate {
  id: string;
  name: string;
  email: string;
  status: "applied" | "interview" | "hired";
  jobId: string;
  job?: { name: string };
  updatedAt: string;
}

interface Job {
  id: string;
  name: string;
}

const columns = [
  { key: "applied", label: "Applied", color: "bg-blue-500" },
  { key: "interview", label: "Interview", color: "bg-amber-500" },
  { key: "hired", label: "Hired", color: "bg-emerald-500" },
];

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", jobId: "" });
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data) {
        router.push("/auth/login");
        return;
      }
      if ((data.user as any).role !== "recruiter") {
        router.push("/");
        return;
      }
      setRole("recruiter");
    });
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedJob !== "all") params.set("jobId", selectedJob);
      const [candRes, jobsRes] = await Promise.all([
        fetch(`/api/candidates?${params}`),
        fetch("/api/jobs"),
      ]);
      const candData = await candRes.json();
      const jobsData = await jobsRes.json();
      setCandidates(candData.data || []);
      setJobs(jobsData.data || []);
    } catch {
      setCandidates([]);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedJob]);

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowModal(false);
      setForm({ name: "", email: "", jobId: "" });
      fetchData();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchData();
    } catch {
      // ignore
    }
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDrop = (status: string) => {
    if (draggedId) {
      handleStatusChange(draggedId, status);
      setDraggedId(null);
    }
  };

  const grouped = candidates.reduce(
    (acc, c) => {
      if (!acc[c.status]) acc[c.status] = [];
      acc[c.status].push(c);
      return acc;
    },
    {} as Record<string, Candidate[]>,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <p className="text-gray-500 mt-1">Track candidates through the pipeline</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Candidate
        </button>
      </div>

      <div className="mb-6">
        <select
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="all">All Jobs</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {columns.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}
              className="bg-gray-50 rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <h3 className="font-semibold text-gray-900 text-sm">{col.label}</h3>
                <span className="ml-auto text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                  {(grouped[col.key] || []).length}
                </span>
              </div>

              <div className="space-y-3 min-h-[200px]">
                {(grouped[col.key] || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No candidates</p>
                ) : (
                  (grouped[col.key] || []).map((candidate) => (
                    <div
                      key={candidate.id}
                      draggable
                      onDragStart={() => handleDragStart(candidate.id)}
                      className="bg-white rounded-lg border border-gray-200 p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-gray-900 text-sm">{candidate.name}</p>
                        <div className="flex gap-1">
                          {columns.map((c) => {
                            if (c.key === candidate.status) return null;
                            return (
                              <button
                                key={c.key}
                                type="button"
                                onClick={() => handleStatusChange(candidate.id, c.key)}
                                title={`Move to ${c.label}`}
                                className={`w-2 h-2 rounded-full ${c.color} opacity-50 hover:opacity-100 transition-opacity`}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">{candidate.email}</p>
                      {candidate.job?.name && (
                        <p className="text-xs text-gray-400 mt-1">{candidate.job.name}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Add Candidate</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddCandidate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Candidate Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Job
                </label>
                <select
                  value={form.jobId}
                  onChange={(e) => setForm({ ...form, jobId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  required
                >
                  <option value="">Select a job</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Adding..." : "Add Candidate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
