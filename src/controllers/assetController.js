const Asset = require('../models/Asset');

const getTenantIdFromRequest = (req) => {
  if (req.user.role === 'admin') {
    return req.query.tenant || null;
  }

  return req.tenantId || req.user.tenant?._id || req.user.tenant || req.user._id;
};

const generateAssetTag = () => `AST-${Date.now().toString().slice(-8)}`;

// ✅ ADD IMAGE UPLOAD HANDLER
exports.uploadAssetImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    res.status(200).json({
      success: true,
      data: {
        imageUrl: imageUrl,
        filename: req.file.filename
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error uploading image',
      error: error.message
    });
  }
};

// Create Asset - ONLY TENANTS CAN CREATE
exports.createAsset = async (req, res) => {
  try {
    // ✅ CHECK IF USER IS TENANT ONLY
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ 
        success: false, // ✅ Add success field
        message: 'Only tenants can create assets' 
      });
    }

    // ✅ DESTRUCTURE ALL FIELDS INCLUDING IMAGE URL
    const {
      name,
      description,
      category,
      location,
      status,
      value,
      purchaseDate,
      lastMaintenanceDate,
      serialNumber,
      manufacturer,
      model,
      imageUrl
    } = req.body;

    // ✅ VALIDATE REQUIRED FIELDS
    if (!name || !description || !serialNumber || !manufacturer || !model) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description, serialNumber, manufacturer, model'
      });
    }

    const tenantId = getTenantIdFromRequest(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Unable to resolve tenant context for asset creation'
      });
    }

    const assetData = {
      name: name.trim(),
      description: description.trim(),
      category,
      location,
      status,
      value: parseFloat(value) || 0,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      lastMaintenanceDate: lastMaintenanceDate ? new Date(lastMaintenanceDate) : new Date(),
      serialNumber: serialNumber.trim(),
      assetTag: req.body.assetTag || generateAssetTag(),
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      condition: req.body.condition,
      warrantyExpiryDate: req.body.warrantyExpiryDate ? new Date(req.body.warrantyExpiryDate) : undefined,
      assignedTo: req.body.assignedTo,
      nextMaintenanceDate: req.body.nextMaintenanceDate ? new Date(req.body.nextMaintenanceDate) : undefined,
      imageUrl: imageUrl || null, // ✅ Include image URL
      tenant: tenantId,
      createdBy: req.user._id,
      updatedBy: req.user._id
    };

    const asset = await Asset.create(assetData);
    res.status(201).json({
      success: true, // ✅ Add success field for consistency
      data: asset
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Get All Assets with Filters - WITH TENANT ISOLATION
exports.getAssets = async (req, res) => {
  try {
    const query = {};
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const tenantId = getTenantIdFromRequest(req);
    
    // ✅ TENANT ISOLATION
    if (tenantId) {
      query.tenant = tenantId;
    }
    
    if (req.query.category) query.category = req.query.category;
    if (req.query.location) query.location = req.query.location;
    if (req.query.status) query.status = req.query.status;
    if (req.query.condition) query.condition = req.query.condition;
    if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;
    if (req.query.maintenanceDue === 'true') {
      query.nextMaintenanceDate = { $lte: new Date() };
    }
    if (req.query.search)
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { serialNumber: { $regex: req.query.search, $options: 'i' } },
        { assetTag: { $regex: req.query.search, $options: 'i' } }
      ];

    const [assets, total] = await Promise.all([
      Asset.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('assignedTo', 'firstName lastName email'),
      Asset.countDocuments(query)
    ]);
    
    res.json({ 
      success: true, // ✅ Add success field
      assets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Get Asset by ID - WITH TENANT ISOLATION
exports.getAsset = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    const tenantId = getTenantIdFromRequest(req);
    
    // ✅ TENANT ISOLATION
    if (tenantId) {
      query.tenant = tenantId;
    }
    
    const asset = await Asset.findOne(query).populate('assignedTo', 'firstName lastName email');
    if (!asset) {
      return res.status(404).json({ 
        success: false,
        message: 'Asset not found' 
      });
    }
    
    res.json({
      success: true, // ✅ Add success field
      data: asset
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Update Asset - ONLY TENANT CAN UPDATE
exports.updateAsset = async (req, res) => {
  try {
    // ✅ CHECK IF USER IS TENANT
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ 
        success: false,
        message: 'Only tenants can update assets' 
      });
    }

    // ✅ SANITIZE UPDATE DATA
    const updateData = { ...req.body };
    const tenantId = getTenantIdFromRequest(req);

    delete updateData.tenant;
    delete updateData.createdBy;
    
    // Convert dates if provided
    if (updateData.purchaseDate) {
      updateData.purchaseDate = new Date(updateData.purchaseDate);
    }
    if (updateData.lastMaintenanceDate) {
      updateData.lastMaintenanceDate = new Date(updateData.lastMaintenanceDate);
    }

    // Convert value to number if provided
    if (updateData.value) {
      updateData.value = parseFloat(updateData.value);
    }

    if (updateData.warrantyExpiryDate) {
      updateData.warrantyExpiryDate = new Date(updateData.warrantyExpiryDate);
    }
    if (updateData.nextMaintenanceDate) {
      updateData.nextMaintenanceDate = new Date(updateData.nextMaintenanceDate);
    }

    updateData.updatedBy = req.user._id;

    const asset = await Asset.findOneAndUpdate(
      { _id: req.params.id, tenant: tenantId },
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!asset) {
      return res.status(404).json({ 
        success: false,
        message: 'Asset not found' 
      });
    }

    res.json({
      success: true,
      data: asset
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Delete Asset - ONLY TENANT CAN DELETE
exports.deleteAsset = async (req, res) => {
  try {
    // ✅ CHECK IF USER IS TENANT
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ 
        success: false,
        message: 'Only tenants can delete assets' 
      });
    }

    const tenantId = getTenantIdFromRequest(req);
    const asset = await Asset.findOneAndDelete({
      _id: req.params.id, 
      tenant: tenantId
    });
    
    if (!asset) {
      return res.status(404).json({ 
        success: false,
        message: 'Asset not found' 
      });
    }

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Get asset dashboard metrics
exports.getAssetStats = async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const match = tenantId ? { tenant: tenantId } : {};

    const [statusBreakdown, categoryBreakdown, totals] = await Promise.all([
      Asset.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Asset.aggregate([
        { $match: match },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      Asset.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalAssets: { $sum: 1 },
            totalValue: { $sum: '$value' }
          }
        }
      ])
    ]);

    const maintenanceDue = await Asset.countDocuments({
      ...match,
      nextMaintenanceDate: { $lte: new Date() }
    });

    res.json({
      success: true,
      data: {
        totalAssets: totals[0]?.totalAssets || 0,
        totalValue: totals[0]?.totalValue || 0,
        maintenanceDue,
        statusBreakdown,
        categoryBreakdown
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
