const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Asset name is required'],
    trim: true,
    maxlength: [100, 'Asset name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['IT Equipment', 'Furniture', 'Vehicles', 'Machinery', 'Other'],
    default: 'IT Equipment'
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    enum: ['Main Office', 'Warehouse A', 'Branch Office', 'Factory Floor', 'Other'],
    default: 'Main Office'
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['Active', 'Maintenance', 'Retired'],
    default: 'Active'
  },
  value: {
    type: Number,
    required: [true, 'Asset value is required'],
    min: [0, 'Asset value cannot be negative']
  },
  purchaseDate: {
    type: Date,
    required: [true, 'Purchase date is required'],
    validate: {
      validator: function (value) {
        return value <= new Date();
      },
      message: 'Purchase date cannot be in the future'
    }
  },
  lastMaintenanceDate: {
    type: Date,
    required: [true, 'Last maintenance date is required'],
    validate: {
      validator: function (value) {
        return !this.purchaseDate || value >= this.purchaseDate;
      },
      message: 'Last maintenance date cannot be before purchase date'
    }
  },
  imageUrl: {
    type: String,
    trim: true
  },
  serialNumber: {
    type: String,
    required: [true, 'Serial number is required'],
    trim: true,
    maxlength: [100, 'Serial number cannot exceed 100 characters']
  },
  assetTag: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [50, 'Asset tag cannot exceed 50 characters']
  },
  manufacturer: {
    type: String,
    required: [true, 'Manufacturer is required'],
    trim: true,
    maxlength: [100, 'Manufacturer name cannot exceed 100 characters']
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    trim: true,
    maxlength: [100, 'Model name cannot exceed 100 characters']
  },
  condition: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor'],
    default: 'Good'
  },
  warrantyExpiryDate: {
    type: Date,
    validate: {
      validator: function (value) {
        if (!value || !this.purchaseDate) return true;
        return value >= this.purchaseDate;
      },
      message: 'Warranty expiry date cannot be before purchase date'
    }
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  nextMaintenanceDate: {
    type: Date,
    validate: {
      validator: function (value) {
        if (!value || !this.purchaseDate) return true;
        return value >= this.purchaseDate;
      },
      message: 'Next maintenance date cannot be before purchase date'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
}, {
  timestamps: true
});

// Indexes
assetSchema.index({ name: 1, category: 1 });
assetSchema.index({ tenant: 1, serialNumber: 1 }, { unique: true });
assetSchema.index({ tenant: 1, assetTag: 1 }, { unique: true, sparse: true });
assetSchema.index({ location: 1 });
assetSchema.index({ status: 1 });
assetSchema.index({ tenant: 1, nextMaintenanceDate: 1 });

module.exports = mongoose.model('Asset', assetSchema);
