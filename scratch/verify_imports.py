import os

def check_motion_imports():
    src_dir = 'c:\\Users\\Administrator\\Desktop\\petlog\\src'
    files_to_check = []
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.tsx'):
                files_to_check.append(os.path.join(root, file))
    
    missing_import = []
    incorrect_import = []
    
    for file_path in files_to_check:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
            has_motion_usage = '<motion' in content or 'motion.' in content or 'AnimatePresence' in content or 'animate(' in content
            
            if has_motion_usage:
                if "from 'framer-motion'" not in content and 'from "framer-motion"' not in content:
                    missing_import.append(file_path)
                if "'motion/react'" in content or '"motion/react"' in content:
                    incorrect_import.append(file_path)
                    
    print(f"Files missing framer-motion import: {missing_import}")
    print(f"Files with residual motion/react import: {incorrect_import}")

if __name__ == '__main__':
    check_motion_imports()
