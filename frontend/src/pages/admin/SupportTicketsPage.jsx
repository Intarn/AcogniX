import { useState, useEffect } from 'react';
import { getAllTicketsAdmin, updateTicketStatus } from '../../services/supportService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

const STATUS_ACTIONS = {
  OPEN: [
    { status: 'RESOLVED', label: 'Resolve', className: 'text-blue-600 hover:underline' },
    { status: 'CLOSED', label: 'Close', className: 'text-red-600 hover:underline' }
  ],
  RESOLVED: [
    { status: 'OPEN', label: 'Reopen', className: 'text-green-600 hover:underline' }
  ],
  CLOSED: [
    { status: 'OPEN', label: 'Reopen', className: 'text-green-600 hover:underline' }
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
        ? `Ticket updated to ${newStatus}, but the email notification could not be sent.`
        : ({ Resolve: 'Ticket resolved successfully.', Close: 'Ticket closed successfully.', Reopen: 'Ticket reopened successfully.' }[action]);

      showToast(
        resultMessage,
        response?.notificationSent === false ? 'warning' : 'success'
      );
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 overflow-hidden">
        <h1 className="text-lg font-bold text-gray-800 truncate mr-4">
          Support Tickets
        </h1>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-32 sm:w-48 md:w-64 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </header>

      <main className="p-6 overflow-y-auto">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4">TICKET CODE</th>
                  <th className="px-6 py-4">REQUESTER</th>
                  <th className="px-6 py-4">SUBJECT</th>
                  <th className="px-6 py-4">DETAILS</th>
                  <th className="px-6 py-4">STATUS</th>
                  <th className="px-6 py-4 whitespace-nowrap">SUBMITTED DATE</th>
                  <th className="px-6 py-4 whitespace-nowrap">LAST UPDATED</th>
                  <th className="px-8 py-4 text-center whitespace-nowrap">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center text-gray-400 text-xs py-10">
                      Loading tickets...
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-gray-400 text-xs py-10">
                      No tickets found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map(ticket => (
                    <tr key={ticket.ticketId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded uppercase tracking-wider">
                          #{ticket.ticketId.split('-')[0]}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-800 whitespace-nowrap">{ticket.User?.displayName || 'Unknown'}</p>
                        <p className="text-[11px] text-gray-400">{ticket.User?.email || 'N/A'}</p>
                      </td>

                      <td className="px-6 py-4 font-bold text-gray-800">
                        {ticket.subject}
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate" title={ticket.description}>
                        {ticket.description}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
                          ticket.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                          ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-[11px] font-medium text-gray-500 whitespace-nowrap">
                        {new Date(ticket.createdAt).toLocaleString('en-GB', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>

                      <td className="px-6 py-4 text-[11px] font-medium text-gray-500 whitespace-nowrap">
                        {new Date(ticket.updatedAt).toLocaleString('en-GB', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>

                      <td className="px-8 py-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-4 min-w-[110px]">
                          {(STATUS_ACTIONS[ticket.status] || []).map(action => (
                            <button
                              key={action.status}
                              onClick={() => handleUpdateStatus(ticket, action.status)}
                              className={`text-xs font-bold ${action.className}`}
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
