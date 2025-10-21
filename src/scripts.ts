import Admin from "./models/admin/Index";

export const createAdmin = async () => {
    const adminData = {
        firstName: "benjamin",
        lastName: "feranmi",
        password: "SecurePass1234",
        email: "ogunbowaleisreal4@gmail.com",

    }

    await Admin.create(adminData)
}

// createAdmin()