import Project from "../models/project.model.js";
import User from "../../identity/models/user.model.js";

const findProjectByIdOrCustom = async (id) => {
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    return await Project.findById(id);
  }
  return await Project.findOne({ projectId: id });
};

export const createProject = async (req, res, next) => {
  try {
    const { title, description, owner, members, status, startDate, projectId } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    // Auto-generate projectId if not provided
    let finalProjectId = projectId;
    if (!finalProjectId) {
      const count = await Project.countDocuments();
      finalProjectId = `PROJ${9000 + count + 1}`;
    }

    const newProject = await Project.create({
      projectId: finalProjectId,
      title,
      description,
      owner,
      members,
      status: status || "active",
      startDate: startDate ? new Date(startDate) : new Date()
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: newProject
    });
  } catch (error) {
    next(error);
  }
};

export const getProjects = async (req, res, next) => {
  try {
    const query = {};
    const { status, category, owner, search, page, limit } = req.query;
    
    if (status) {
      query.status = status.toLowerCase();
    }

    if (category) {
      query.category = category.toLowerCase();
    }

    if (owner) {
      // Owner can be name or userId. Let's find user with that name or userId first.
      const ownerQuery = owner.trim();
      const users = await User.find({
        $or: [
          { name: { $regex: ownerQuery, $options: "i" } },
          { userId: ownerQuery }
        ]
      });
      const userIds = users.map(u => u.userId);
      if (userIds.length > 0) {
        query.owner = { $in: userIds };
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { projectId: { $regex: search, $options: "i" } }
      ];
    }

    const total = await Project.countDocuments(query);
    let projects;
    let responseObj = {
      success: true,
      message: "Data fetched successfully"
    };

    if (page || limit) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const skip = (pageNum - 1) * limitNum;
      projects = await Project.find(query).skip(skip).limit(limitNum);
      responseObj.page = pageNum;
      responseObj.limit = limitNum;
      responseObj.total = total;
      responseObj.totalPages = Math.ceil(total / limitNum);
    } else {
      projects = await Project.find(query);
    }

    responseObj.data = projects;
    return res.status(200).json(responseObj);
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const project = await findProjectByIdOrCustom(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Project fetched successfully",
      data: project
    });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const project = await findProjectByIdOrCustom(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const allowedUpdates = ["title", "description", "owner", "members", "status", "startDate"];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === "startDate" && req.body[field]) {
          project.startDate = new Date(req.body[field]);
        } else if (field === "status") {
          project.status = req.body[field].toLowerCase();
        } else {
          project[field] = req.body[field];
        }
      }
    });

    await project.save();

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project
    });
  } catch (error) {
    next(error);
  }
};
