import { apiRequest } from './apiClient';

// USER (LEARNER / EDUCATOR)
export const createTicket = async (subject, description) => {
  return await apiRequest('/support/tickets', {
    method: 'POST',
    body: JSON.stringify({ subject, description })
  });
};

export const getMyTickets = async () => {
  return await apiRequest('/support/tickets', { method: 'GET' });
};

// ADMIN
export const getAllTicketsAdmin = async (status = 'ALL') => {
  return await apiRequest(`/admin/tickets?status=${status}`, { method: 'GET' });
};

export const updateTicketStatus = async (ticketId, status) => {
  return await apiRequest(`/admin/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
};

export const getTicketsCount = async () => {
  return await apiRequest('/admin/tickets/count', { method: 'GET' });
};