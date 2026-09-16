import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../api/client';

export const EditPersonnelModal = ({ person, onClose, onSuccess }: { person: any, onClose: () => void, onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    full_name: person.full_name || '',
    employee_code: person.employee_code || '',
    category: person.category || 'Uniform',
    gender: person.gender || 'Male',
    rank_id: person.rank_id || '',
    department_id: person.department_id || '',
    course_id: person.course_id || '',
    designation: person.designation || '',
    duty_type: person.duty_type || '',
    shift_id: person.shift_id || '',
    phone: person.phone || '',
    cnic: person.cnic || '',
    employment_status: person.employment_status || 'Active'
  });

  const [ranksList, setRanksList] = useState<any[]>([]);
  const [deptsList, setDeptsList] = useState<any[]>([]);
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [ranksRes, deptsRes, shiftsRes, coursesRes] = await Promise.all([
          api.get('/ranks?page_size=100'),
          api.get('/departments?page_size=100'),
          api.get('/shifts?page_size=100'),
          api.get('/courses?page_size=50'),
        ]);
        setRanksList(ranksRes.data?.data || []);
        setDeptsList(deptsRes.data?.data || []);
        setShiftsList(shiftsRes.data?.data || []);
        setCoursesList(coursesRes.data?.data || []);
      } catch (err) {
        console.error("Failed to load metadata for edit modal", err);
      }
    };
    fetchMetadata();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: any = { ...formData };
      if (payload.rank_id) payload.rank_id = parseInt(payload.rank_id as string, 10);
      else payload.rank_id = null;

      if (payload.department_id) payload.department_id = parseInt(payload.department_id as string, 10);
      else payload.department_id = null;

      if (payload.shift_id) payload.shift_id = parseInt(payload.shift_id as string, 10);
      else payload.shift_id = null;

      if (person.is_trainee) {
        payload.rank_id = null;
        payload.department_id = null;
        payload.designation = null;
        payload.duty_type = null;
        payload.category = 'Trainee';
        payload.course_id = payload.course_id ? parseInt(payload.course_id as string, 10) : null;
      } else {
        payload.course_id = null;
      }

      if (!payload.duty_type) payload.duty_type = null;
      if (!payload.designation) payload.designation = null;
      if (!payload.phone) payload.phone = null;
      if (!payload.cnic) payload.cnic = null;
      if (!payload.employee_code) payload.employee_code = null;

      await api.put(`/personnel/${person.id}`, payload);
      onSuccess();
    } catch (err: any) {
      console.error("Failed to update personnel", err);
      alert(err.response?.data?.detail || "Failed to update personnel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-lg text-slate-800">Edit {person.is_trainee ? 'Trainee' : 'Staff'}</h3>
            <p className="text-xs text-slate-400">PIN: {person.biometric_user_id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Full Name *</label>
            <input 
              type="text" 
              required
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Service / Emp Code</label>
              <input 
                type="text" 
                value={formData.employee_code}
                onChange={(e) => setFormData({...formData, employee_code: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            {!person.is_trainee && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="Uniform">Uniform</option>
                <option value="Non-Uniform">Non-Uniform</option>
              </select>
            </div>
            )}
          </div>

          {person.is_trainee ? (
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Course</label>
            <select
              value={formData.course_id}
              onChange={(e) => setFormData({...formData, course_id: e.target.value})}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
            >
              <option value="">Select Course...</option>
              {coursesList.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Rank / Grade</label>
              <select
                value={formData.rank_id}
                onChange={(e) => setFormData({...formData, rank_id: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">Select Rank...</option>
                {ranksList.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Department</label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">Select Department...</option>
                {deptsList.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {!person.is_trainee && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Duty Type</label>
              <select
                value={formData.duty_type}
                onChange={(e) => setFormData({...formData, duty_type: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">General (Default)</option>
                <option value="Security">Security Guard / Sentry</option>
                <option value="Clerical">Clerical / Office</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Assigned Shift</label>
              <select
                value={formData.shift_id}
                onChange={(e) => setFormData({...formData, shift_id: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">Auto / Default</option>
                {shiftsList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.start_time.substring(0,5)})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phone</label>
              <input 
                type="text" 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">CNIC</label>
              <input 
                type="text" 
                value={formData.cnic}
                onChange={(e) => setFormData({...formData, cnic: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Status</label>
            <select
              value={formData.employment_status}
              onChange={(e) => setFormData({...formData, employment_status: e.target.value})}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
