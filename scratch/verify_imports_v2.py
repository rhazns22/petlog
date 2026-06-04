import os
import sys

def check_motion_imports():
    src_dir = r'c:\Users\Administrator\Desktop\petlog\src'
    missing = []
    residual = []
    
    try:
        for root, dirs, files in os.walk(src_dir):
            for file in files:
                if file.endswith('.tsx'):
                    path = os.path.join(root, file)
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        has_usage = '<motion' in content or 'motion.' in content or 'AnimatePresence' in content or 'animate(' in content
                        if has_usage:
                            if "from 'framer-motion'" not in content and 'from "framer-motion"' not in content:
                                missing.append(path)
                        if "'motion/react'" in content or '"motion/react"' in content:
                            residual.append(path)
        
        print("MISSING_IMPORTS:", missing)
        print("RESIDUAL_IMPORTS:", residual)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    check_motion_imports()
