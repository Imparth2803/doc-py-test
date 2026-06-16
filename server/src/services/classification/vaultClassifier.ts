export interface VaultClassification {
  vaultCategory: string;
  vaultFolder: string;
}

export interface VaultClassification {
  vaultCategory: string;
  vaultFolder: string;
}

export const classifyDocument = (
  documentText: string
): VaultClassification => {

  const type = documentText.toLowerCase();

  // =====================================
  // THE INDIVIDUAL
  // =====================================

  // Identity Documents
  if (
    type.includes("passport") ||
    type.includes("aadhaar") ||
    type.includes("aadhar") ||
    type.includes("pan") ||
    type.includes("voter") ||
    type.includes("driving license") ||
    type.includes("identity")
  ) {
    return {
      vaultCategory: "The Individual",
      vaultFolder: "00_Identity_and_Emergency"
    };
  }

  // Medical Documents
  if (
    type.includes("medical") ||
    type.includes("hospital") ||
    type.includes("health") ||
    type.includes("prescription") ||
    type.includes("diagnosis") ||
    type.includes("lab report") ||
    type.includes("blood test") ||
    type.includes("insurance claim")
  ) {
    return {
      vaultCategory: "The Individual",
      vaultFolder: "01_Health_and_Medical"
    };
  }

  // Personal Finance
  if (
    type.includes("bank") ||
    type.includes("statement") ||
    type.includes("salary") ||
    type.includes("payslip") ||
    type.includes("loan") ||
    type.includes("investment") ||
    type.includes("mutual fund") ||
    type.includes("fd") ||
    type.includes("fixed deposit")
  ) {
    return {
      vaultCategory: "The Individual",
      vaultFolder: "02_Finance_and_Wealth"
    };
  }

  // Education & Career
  if (
    type.includes("resume") ||
    type.includes("cv") ||
    type.includes("degree") ||
    type.includes("certificate") ||
    type.includes("marksheet") ||
    type.includes("transcript") ||
    type.includes("offer letter") ||
    type.includes("experience letter") ||
    type.includes("employment") ||
    type.includes("internship")
  ) {
    return {
      vaultCategory: "The Individual",
      vaultFolder: "03_Education_and_Career"
    };
  }

  // Hobbies & Self Development
  if (
    type.includes("course") ||
    type.includes("training") ||
    type.includes("workshop") ||
    type.includes("hobby") ||
    type.includes("sports") ||
    type.includes("certification")
  ) {
    return {
      vaultCategory: "The Individual",
      vaultFolder: "04_Hobbies_and_Self_Dev"
    };
  }

  // =====================================
  // THE BUSINESS
  // =====================================

  // Incorporation & Legal
  if (
    type.includes("incorporation") ||
    type.includes("registration") ||
    type.includes("partnership") ||
    type.includes("moa") ||
    type.includes("aoa") ||
    type.includes("legal agreement") ||
    type.includes("business license")
  ) {
    return {
      vaultCategory: "The Business",
      vaultFolder: "00_Incorporation_and_Legal"
    };
  }

  // Finance & Tax
  if (
    type.includes("gst") ||
    type.includes("tax") ||
    type.includes("itr") ||
    type.includes("audit") ||
    type.includes("invoice") ||
    type.includes("purchase order") ||
    type.includes("balance sheet")
  ) {
    return {
      vaultCategory: "The Business",
      vaultFolder: "01_Finance_and_Tax"
    };
  }

  // HR & Management
  if (
    type.includes("employee") ||
    type.includes("hr") ||
    type.includes("appraisal") ||
    type.includes("attendance") ||
    type.includes("payroll")
  ) {
    return {
      vaultCategory: "The Business",
      vaultFolder: "02_HR_and_Management"
    };
  }

  // Operations & Supply
  if (
    type.includes("vendor") ||
    type.includes("supplier") ||
    type.includes("inventory") ||
    type.includes("shipment") ||
    type.includes("purchase")
  ) {
    return {
      vaultCategory: "The Business",
      vaultFolder: "03_Operations_and_Supply"
    };
  }

  // =====================================
  // THE ASSET
  // =====================================

  // Ownership & Legal
  if (
    type.includes("property") ||
    type.includes("sale deed") ||
    type.includes("lease") ||
    type.includes("rent agreement") ||
    type.includes("ownership") ||
    type.includes("land") ||
    type.includes("flat") ||
    type.includes("apartment")
  ) {
    return {
      vaultCategory: "The Asset",
      vaultFolder: "00_Ownership_and_Legal"
    };
  }

  // Insurance & Taxes
  if (
    type.includes("insurance") ||
    type.includes("vehicle tax") ||
    type.includes("property tax")
  ) {
    return {
      vaultCategory: "The Asset",
      vaultFolder: "01_Insurance_and_Taxes"
    };
  }

  // Utilities & Telecom
  if (
    type.includes("electricity") ||
    type.includes("water bill") ||
    type.includes("gas bill") ||
    type.includes("internet bill") ||
    type.includes("broadband") ||
    type.includes("mobile bill") ||
    type.includes("telecom") ||
    type.includes("torrent power") ||
    type.includes("utility bill")
  ) {
    return {
      vaultCategory: "The Asset",
      vaultFolder: "02_Utilities_and_Telecom"
    };
  }

  // Appliances & Warranties
  if (
    type.includes("warranty") ||
    type.includes("appliance") ||
    type.includes("electronics") ||
    type.includes("purchase receipt")
  ) {
    return {
      vaultCategory: "The Asset",
      vaultFolder: "03_Appliances_and_Warranties"
    };
  }

  // Maintenance & Inventory
  if (
    type.includes("maintenance") ||
    type.includes("repair") ||
    type.includes("service record")
  ) {
    return {
      vaultCategory: "The Asset",
      vaultFolder: "04_Maintenance_and_Inventory"
    };
  }

  // =====================================
  // THE HOUSEHOLD
  // =====================================

  // Legal & Legacy
  if (
    type.includes("will") ||
    type.includes("nomination") ||
    type.includes("estate") ||
    type.includes("legacy")
  ) {
    return {
      vaultCategory: "The Household",
      vaultFolder: "00_Legal_and_Legacy"
    };
  }

  // Family Life & Media
  if (
    type.includes("marriage") ||
    type.includes("birth certificate") ||
    type.includes("family") ||
    type.includes("photo") ||
    type.includes("media")
  ) {
    return {
      vaultCategory: "The Household",
      vaultFolder: "01_Family_Life_and_Media"
    };
  }

  // =====================================
  // FALLBACK
  // =====================================

  return {
    vaultCategory: "The Household",
    vaultFolder: "99_System_and_Staging"
  };
};