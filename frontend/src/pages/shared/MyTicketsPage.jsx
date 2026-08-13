import { useState, useEffect } from 'react';
import { getMyTickets, createTicket } from '../../services/supportService';

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      const res = await getMyTickets();
      setTickets(res.tickets || []);
    } catch (error) {
      console.error("Failed to load tickets", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    try {
      setSubmitting(true);
      await createTicket(subject, description);
      setSubject('');
      setDescription('');
      alert("Ticket submitted successfully!");
      fetchMyTickets();
    } catch (error) {
      alert("Failed to submit ticket: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 p-6 lg:p-8 bg-gray-50 overflow-y-auto flex flex-col lg:flex-row gap-8">
      {/* CỘT TRÁI: FORM TẠO TICKET */}
      <div className="w-full lg:w-1/3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Contact Support</h2>
          <p className="text-xs text-gray-500 mb-6">Encountered an issue? Send us a ticket.</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Subject</label>
              <input 
                type="text" required value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                placeholder="e.g., Cannot access my course" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
              <textarea 
                required rows="5" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none resize-none focus:border-blue-500"
                placeholder="Describe your issue in detail..." 
              />
            </div>
            <button 
              type="submit" disabled={submitting || !subject.trim() || !description.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </form>
        </div>
      </div>

      {/* CỘT PHẢI: LỊCH SỬ TICKET */}
      <div className="w-full lg:w-2/3">
        <h2 className="text-lg font-bold text-gray-800 mb-4">My Tickets History</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading your tickets...</p>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-500 text-sm">You haven't submitted any support tickets yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map(ticket => (
              <div key={ticket.ticketId} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-800">{ticket.subject}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        ticket.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                        ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{ticket.description}</p>
                <p className="text-xs text-gray-400">Submitted on: {new Date(ticket.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}