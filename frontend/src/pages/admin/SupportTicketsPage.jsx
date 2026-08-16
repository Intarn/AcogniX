import { useState, useEffect } from 'react';
import { getAllTicketsAdmin, updateTicketStatus } from '../../services/supportService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

const STATUS_ACTIONS = {
  OPEN: [
    { status: 'RESOLVED', label: 'Resolve', className: 'text-blue-600 hover:underline font-bold' },
    { status: 'CLOSED', label: 'Close', className: 'text-red-600 hover:underline font-bold' }
  ],
  RESOLVED: [
    { status: 'OPEN', label: 'Reopen', className: 'text-emerald-600 hover:underline font-bold' }
  ],
  CLOSED: [
    { status: 'OPEN', label: 'Reopen', className: 'text-emerald-600 hover:underline font-bold' }
  ]
};

const STATUS_CONFIRM_MESSAGES = {
  RESOLVED: 'Are you sure you want to mark this ticket as resolved? An email notification will be sent to the requester.',
  CLOSED: 'Are you sure you want to close this ticket? An email notification will be sent to the requester.',
  OPEN: 'Are you sure you want to reopen this ticket? An email notification will be sent to the requester.'
};

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await getAllTicketsAdmin(filter);
      setTickets(res.tickets || []);
    } catch (error) {
      showToast(`Failed to load tickets: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (ticket, newStatus) => {
    const action = newStatus === 'OPEN' ? 'Reopen' : newStatus === 'RESOLVED' ? 'Resolve' : 'Close';
    const tone = newStatus === 'CLOSED' ? 'danger' : newStatus === 'OPEN' ? 'success' : 'primary';

    const confirmed = await confirm({
      title: `${action} support ticket?`,
      message: STATUS_CONFIRM_MESSAGES[newStatus],
      confirmLabel: action,
      cancelLabel: 'Cancel',
      tone
    });

    if (!confirmed) return;

    try {
      const response = await updateTicketStatus(ticket.ticketId, newStatus);
      await fetchTickets();

      const resultMessage = response?.notificationSent === false
        ? `Ticket updated to ${newStatus}, but email notification failed to deliver.`
        : ({ Resolve: 'Ticket resolved successfully.', Close: 'Ticket closed successfully.', Reopen: 'Ticket reopened successfully.' }[action]);

      showToast(resultMessage, response?.notificationSent === false ? 'warning' : 'success');
    } catch (error) {
      showToast(`Update failed: ${error.message}`, 'error');
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const term = searchTerm.toLowerCase();
    return (
      (ticket.subject || '').toLowerCase().includes(term) ||
      (ticket.description || '').toLowerCase().includes(term) ||
      (ticket.User?.displayName && ticket.User.displayName.toLowerCase().includes(term)) ||
      (ticket.User?.email && ticket.User.email.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 py-4 flex-shrink-0 gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Support Tickets</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">Manage user inquiries and issue resolutions.</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 text-xs bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 outline-none focus:border-blue-600 focus:bg-white transition shadow-xs"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-2xl px-4 py-2.5 bg-gray-50 font-bold text-gray-700 outline-none focus:border-blue-600 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Status</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Ticket ID</th>
                  <th className="px-6 py-4">Requester</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Submitted Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-10 text-gray-400 font-bold">Loading support tickets...</td></tr>
                ) : filteredTickets.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-10 text-gray-400 font-bold">No support tickets found.</td></tr>
                ) : (
                  filteredTickets.map(ticket => (
                    <tr key={ticket.ticketId} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4">
                        <span className="font-mono text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                          #{ticket.ticketId.split('-')[0]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{ticket.User?.displayName || 'Unknown'}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{ticket.User?.email || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">{ticket.subject}</td>
                      <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={ticket.description}>{ticket.description}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          ticket.status === 'OPEN' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          ticket.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(ticket.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {(STATUS_ACTIONS[ticket.status] || []).map(action => (
                            <button
                              key={action.status}
                              onClick={() => handleUpdateStatus(ticket, action.status)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition ${action.status === 'RESOLVED' ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : action.status === 'CLOSED' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}