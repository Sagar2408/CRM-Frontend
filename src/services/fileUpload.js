import apiService from "./apiService";

export const uploadFile = async (input) => {
  const formData = new FormData();

  if (input instanceof File) {
    // Handle actual file upload
    if (!input) throw new Error("Please select a file first!");
    formData.append("file", input);
  } else {
    // Handle single lead data from form
    if (!input || !input.name) throw new Error("Name is required for lead creation!");

    // Create CSV content
    const headers = [
      "name",
      "email",
      "phone",
      "education",
      "experience",
      "state",
      "country",
      "dob",
      "countryPreference",
    ];
    const escapeCsvValue = (value) => {
      if (value == null) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const values = headers.map((header) => escapeCsvValue(input[header]));
    const csvContent = [headers.join(","), values.join(",")].join("\n");

    // Create Blob and append to FormData
    const blob = new Blob([csvContent], { type: "text/csv" });
    formData.append("file", blob, "single_lead.csv");
  }

  try {
    const response = await apiService.post("/client-leads/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "File upload failed!");
  }
};