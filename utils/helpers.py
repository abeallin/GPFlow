# from enum import Enum

# class Category(Enum):
#     MESSAGE_PATIENT = "Message Patient"
#     VIDEO_CONSULTANT = "Video Consult"

# def create_template_object(template_name, category, snomed, message="", individual=True, batch=False, allow_patient_to_respond=False):
def create_template_object(template_name, message="", individual=True, batch=False, allow_patient_to_respond=False):
    # if category not in Category._value2member_map_:
    #     raise ValueError(f"Invalid category. Choose from: {[c.value for c in Category]}")
    return {
        "template_name": template_name,
        # "category": category,
        "message": message,
        # "snomed": snomed,
        "individual": individual,
        "batch": batch,
        "allow_patient_to_respond": allow_patient_to_respond
    }
