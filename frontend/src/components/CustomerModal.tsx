import { useState, useEffect } from 'react'

interface MockCustomer {
  id: string
  user_name: string
  job_title: string
  company_name: string
  company_description: string
  company_size: string
  company_sector: string
  is_default: boolean
  created_at: string
  updated_at: string
}

interface CustomerModalProps {
  isOpen: boolean
  onClose: () => void
  customers: MockCustomer[]
  onAdd: (customer: Omit<MockCustomer, 'id' | 'created_at' | 'updated_at'>) => void
  onEdit: (customer: MockCustomer) => void
  onDelete: (customerId: string) => void
  onSetAsDefault: (customerId: string) => void
  loading?: boolean
  theme: any
}

export function CustomerModal({
  isOpen,
  onClose,
  customers,
  onAdd,
  onEdit,
  onDelete,
  onSetAsDefault,
  loading = false,
  theme
}: CustomerModalProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<MockCustomer | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({
    user_name: '',
    job_title: '',
    company_name: '',
    company_description: '',
    company_size: '',
    company_sector: '',
    is_default: false
  })

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer =>
    customer.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.job_title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowAddForm(false)
      setEditingCustomer(null)
      setSearchQuery('')
      resetForm()
    }
  }, [isOpen])

  const resetForm = () => {
    setFormData({
      user_name: '',
      job_title: '',
      company_name: '',
      company_description: '',
      company_size: '',
      company_sector: '',
      is_default: false
    })
  }

  const handleSubmit = () => {
    if (editingCustomer) {
      onEdit({ ...editingCustomer, ...formData })
      setEditingCustomer(null)
    } else {
      onAdd(formData)
      setShowAddForm(false)
    }
    resetForm()
  }

  const handleEdit = (customer: MockCustomer) => {
    setFormData({
      user_name: customer.user_name,
      job_title: customer.job_title,
      company_name: customer.company_name,
      company_description: customer.company_description,
      company_size: customer.company_size,
      company_sector: customer.company_sector,
      is_default: customer.is_default
    })
    setEditingCustomer(customer)
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingCustomer(null)
    resetForm()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Modal Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={onClose}
      >
        {/* Modal Content */}
        <div 
          style={{
            backgroundColor: theme.bg,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h2 style={{ 
                color: theme.text, 
                fontSize: '20px', 
                fontWeight: '600', 
                margin: 0,
                marginBottom: '4px'
              }}>
                Mock Customers
              </h2>
              <p style={{ 
                color: theme.textMuted, 
                fontSize: '14px', 
                margin: 0 
              }}>
                Manage customer profiles for function calling tests
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: theme.textMuted,
                cursor: 'pointer',
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          {/* Controls Bar */}
          <div style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: theme.bgSecondary,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  color: theme.text,
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Add Customer Button */}
            <button
              onClick={() => setShowAddForm(true)}
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.accent,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              + Add Customer
            </button>
          </div>

          {/* Content */}
          <div style={{ 
            flex: 1, 
            overflow: 'auto',
            padding: showAddForm ? '0' : '16px'
          }}>
            {showAddForm ? (
              /* Add/Edit Form */
              <div style={{ padding: '24px' }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  margin: '0 0 16px 0' 
                }}>
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h3>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        color: theme.text, 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        marginBottom: '6px' 
                      }}>
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={formData.user_name}
                        onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                        placeholder="e.g., Scott"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: theme.bgSecondary,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          color: theme.text,
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{ 
                        display: 'block', 
                        color: theme.text, 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        marginBottom: '6px' 
                      }}>
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={formData.job_title}
                        onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                        placeholder="e.g., Head of Marketing"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: theme.bgSecondary,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          color: theme.text,
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        color: theme.text, 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        marginBottom: '6px' 
                      }}>
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        placeholder="e.g., Quick Fit Windows"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: theme.bgSecondary,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          color: theme.text,
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ 
                        display: 'block', 
                        color: theme.text, 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        marginBottom: '6px' 
                      }}>
                        Company Size
                      </label>
                      <select
                        value={formData.company_size}
                        onChange={(e) => setFormData({ ...formData, company_size: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: theme.bgSecondary,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          color: theme.text,
                          fontSize: '14px'
                        }}
                      >
                        <option value="">Select size...</option>
                        <option value="1 to 10 people">1 to 10 people</option>
                        <option value="10 to 20 people">10 to 20 people</option>
                        <option value="20 to 50 people">20 to 50 people</option>
                        <option value="50 to 100 people">50 to 100 people</option>
                        <option value="100+ people">100+ people</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      color: theme.text, 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      marginBottom: '6px' 
                    }}>
                      Company Sector
                    </label>
                    <input
                      type="text"
                      value={formData.company_sector}
                      onChange={(e) => setFormData({ ...formData, company_sector: e.target.value })}
                      placeholder="e.g., window repairs"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: theme.bgSecondary,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '6px',
                        color: theme.text,
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      color: theme.text, 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      marginBottom: '6px' 
                    }}>
                      Company Description
                    </label>
                    <textarea
                      value={formData.company_description}
                      onChange={(e) => setFormData({ ...formData, company_description: e.target.value })}
                      placeholder="Brief description of the company..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: theme.bgSecondary,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '6px',
                        color: theme.text,
                        fontSize: '14px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.text, 
                      fontSize: '14px', 
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={formData.is_default}
                        onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                        style={{
                          width: '16px',
                          height: '16px',
                          accentColor: theme.accent
                        }}
                      />
                      Set as default customer
                    </label>
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  marginTop: '24px',
                  justifyContent: 'flex-end' 
                }}>
                  <button
                    onClick={handleCancel}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: theme.bgSecondary,
                      color: theme.text,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!formData.user_name || !formData.company_name}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: theme.accent,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: (!formData.user_name || !formData.company_name) ? 'not-allowed' : 'pointer',
                      opacity: (!formData.user_name || !formData.company_name) ? 0.6 : 1
                    }}
                  >
                    {editingCustomer ? 'Update Customer' : 'Add Customer'}
                  </button>
                </div>
              </div>
            ) : (
              /* Customer List */
              <div style={{ padding: '8px' }}>
                {filteredCustomers.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '40px',
                    color: theme.textMuted 
                  }}>
                    {customers.length === 0 ? 'No customers yet. Add your first customer to get started.' : 'No customers match your search.'}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        style={{
                          padding: '16px',
                          backgroundColor: theme.bgSecondary,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <h4 style={{ 
                              color: theme.text, 
                              fontSize: '16px', 
                              fontWeight: '600', 
                              margin: 0 
                            }}>
                              {customer.user_name}
                            </h4>
                            {customer.is_default && (
                              <span style={{
                                padding: '2px 6px',
                                backgroundColor: theme.accent,
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: '600',
                                borderRadius: '4px'
                              }}>
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <p style={{ 
                            color: theme.textSecondary, 
                            fontSize: '14px', 
                            margin: '0 0 8px 0' 
                          }}>
                            {customer.job_title} at {customer.company_name}
                          </p>
                          <p style={{ 
                            color: theme.textMuted, 
                            fontSize: '13px', 
                            margin: 0,
                            lineHeight: '1.4'
                          }}>
                            {customer.company_description}
                          </p>
                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '8px',
                            fontSize: '12px',
                            color: theme.textMuted
                          }}>
                            <span>{customer.company_size}</span>
                            <span>•</span>
                            <span>{customer.company_sector}</span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                          {!customer.is_default && (
                            <button
                              onClick={() => onSetAsDefault(customer.id)}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: 'transparent',
                                border: `1px solid ${theme.border}`,
                                borderRadius: '4px',
                                color: theme.textMuted,
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Set as default"
                            >
                              ⭐
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(customer)}
                            style={{
                              padding: '6px 8px',
                              backgroundColor: 'transparent',
                              border: `1px solid ${theme.border}`,
                              borderRadius: '4px',
                              color: theme.textMuted,
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDelete(customer.id)}
                            style={{
                              padding: '6px 8px',
                              backgroundColor: 'transparent',
                              border: `1px solid ${theme.border}`,
                              borderRadius: '4px',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}