import fitz
import sys
import json
import os

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"isEncrypted": False, "decrypted": False, "error": "Missing file path argument"}))
        sys.exit(1)

    file_path = sys.argv[1]
    options = {}
    if len(sys.argv) > 2:
        try:
            options = json.loads(sys.argv[2])
        except Exception as e:
            pass

    if not os.path.exists(file_path):
        print(json.dumps({"isEncrypted": False, "decrypted": False, "error": f"File does not exist: {file_path}"}))
        sys.exit(1)

    try:
        doc = fitz.open(file_path)
        is_encrypted = doc.is_encrypted
        if not is_encrypted:
            doc.close()
            print(json.dumps({"isEncrypted": False, "decrypted": False, "error": None}))
            sys.exit(0)
    except Exception as e:
        print(json.dumps({"isEncrypted": False, "decrypted": False, "error": f"Failed to open PDF: {str(e)}"}))
        sys.exit(1)

    # Compile password candidates
    passwords = []
    
    # 1. Try manual password if provided
    manual_pw = options.get("manualPassword")
    if manual_pw:
        passwords.append(manual_pw)

    # 2. Try empty password
    passwords.append("")

    # 3. Try user profile candidate passwords
    user_profile = options.get("userProfile")
    if user_profile and isinstance(user_profile, dict):
        for key in ["pan", "phone", "email", "dob", "name", "zip"]:
            val = user_profile.get(key)
            if val:
                val_str = str(val).strip()
                passwords.append(val_str)
                
                # Variations for name + DOB combination
                if key == "name" and "dob" in user_profile:
                    dob_val = str(user_profile["dob"]).strip()
                    digits = "".join(filter(str.isdigit, dob_val))
                    name_part = "".join(filter(str.isalpha, val_str))[:4].upper()
                    
                    if len(digits) >= 4:
                        # e.g., NAME1988 or NAMEDDMM
                        passwords.append(f"{name_part}{digits[:4]}")
                        passwords.append(f"{name_part}{digits[-4:]}")
                        if len(digits) >= 8:
                            # name + YYYY (e.g. from YYYY-MM-DD, digits[:4] is YYYY, digits[4:8] is MMDD/DDMM depending on format)
                            passwords.append(f"{name_part}{digits[4:8]}")
                            passwords.append(f"{name_part}{digits[2:6]}")

    # Try decrypting
    decrypted = False
    for pw in passwords:
        try:
            res = doc.authenticate(pw)
            if res > 0:
                decrypted = True
                break
        except Exception:
            continue

    if decrypted:
        try:
            temp_path = file_path + ".tmp_decrypted"
            doc.save(temp_path, incremental=False)
            doc.close()
            
            # Atomic replace
            os.replace(temp_path, file_path)
            
            print(json.dumps({"isEncrypted": True, "decrypted": True, "error": None}))
            sys.exit(0)
        except Exception as e:
            if os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass
            doc.close()
            print(json.dumps({"isEncrypted": True, "decrypted": False, "error": f"Failed to save decrypted PDF: {str(e)}"}))
            sys.exit(1)
    else:
        doc.close()
        print(json.dumps({"isEncrypted": True, "decrypted": False, "error": "Incorrect password"}))
        sys.exit(0)

if __name__ == "__main__":
    main()
