# Role Management Runbook

## 🔐 **Role Management Procedures**

### **Available Roles**

| Role | Description | Capabilities |
|------|-------------|--------------|
| `DEFAULT_ADMIN_ROLE` | Full administrative control | All operations |
| `UPGRADER_ROLE` | Contract upgrades | Upgrade implementation |
| `ADMIN_PAUSER_ROLE` | Pause/unpause control | Emergency controls |
| `BOT_PAUSER_ROLE` | Automated pause | Pause only |
| `GOVERNANCE_UNPAUSER_ROLE` | Governance unpause | Unpause only |
| `EMERGENCY_GUARDIAN_ROLE` | Emergency pause | Emergency pause |
| `BLOCKLIST_MANAGER_ROLE` | Blocklist management | Add/remove blocked addresses |
| `WHITELIST_MANAGER_ROLE` | Whitelist management | Add/remove whitelisted addresses |
| `CIRCUIT_BREAKER_ROLE` | Circuit breaker control | Configure protection |
| `PARAM_MANAGER_ROLE` | Parameter updates | Update contract parameters |
| `FINANCE_ROLE` | Financial operations | Treasury operations |

### **Granting Roles**

#### **Step 1: Verify Authority**
- Confirm caller has `DEFAULT_ADMIN_ROLE`
- Validate recipient address
- Document role assignment reason

#### **Step 2: Grant Role**
```bash
# Grant role to address
await contract.grantRole(ROLE_HASH, recipientAddress)

# Verify role assignment
await contract.hasRole(ROLE_HASH, recipientAddress) // Should return true
```

#### **Step 3: Test Role**
- Verify recipient can perform role functions
- Document successful assignment
- Update role registry

### **Revoking Roles**

#### **Step 1: Verify Authority**
- Confirm caller has `DEFAULT_ADMIN_ROLE`
- Validate revocation reason
- Check for dependencies

#### **Step 2: Revoke Role**
```bash
# Revoke role from address
await contract.revokeRole(ROLE_HASH, recipientAddress)

# Verify role revocation
await contract.hasRole(ROLE_HASH, recipientAddress) // Should return false
```

#### **Step 3: Update Systems**
- Remove from monitoring systems
- Update documentation
- Notify relevant teams

### **Role Rotation Procedures**

#### **Quarterly Review**
- Review all role assignments
- Verify role necessity
- Check for inactive accounts
- Update role registry

#### **Emergency Rotation**
- Immediate role revocation for compromised accounts
- Temporary role assignment to backup accounts
- Full system audit post-incident

### **Multi-sig Configuration**

#### **Treasury Setup**
```bash
# Configure Gnosis Safe
# Set threshold: 3 of 5 signers
# Add signers: [Admin addresses]
# Enable modules: [Required modules]
```

#### **Governance Setup**
```bash
# Configure Timelock
# Set delay: 24-48 hours
# Add proposers: [Governance addresses]
# Add executors: [Admin addresses]
```

## 📋 **Role Management Checklist**

### **Pre-Deployment**
- [ ] Define role hierarchy
- [ ] Assign initial roles
- [ ] Configure multi-sig
- [ ] Test role functions
- [ ] Document assignments

### **Post-Deployment**
- [ ] Verify role assignments
- [ ] Test all role functions
- [ ] Configure monitoring
- [ ] Train role holders
- [ ] Document procedures

### **Ongoing Management**
- [ ] Regular role audits
- [ ] Quarterly reviews
- [ ] Emergency procedures
- [ ] Role rotation schedule
- [ ] Documentation updates

## 🚨 **Emergency Procedures**

### **Compromised Account**
1. Immediately revoke all roles
2. Pause contract if necessary
3. Investigate compromise scope
4. Assign temporary roles
5. Implement security measures
6. Conduct full audit

### **Role Holder Unavailable**
1. Identify backup role holder
2. Grant temporary role
3. Document delegation
4. Monitor for issues
5. Restore normal operations

## 📞 **Contact Information**

- **Role Administrator:** [Contact Information]
- **Security Team:** [Contact Information]
- **Technical Team:** [Contact Information]

---

*This runbook should be reviewed quarterly and updated based on operational experience.*
