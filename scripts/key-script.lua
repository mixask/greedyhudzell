-- ========================== GREEDY HUDZELL KEY SYSTEM ==========================
-- This script validates the license key before loading the main script.
-- If the key is valid, it loads Part 2. Otherwise, it shows an error.
-- 🔄 Auto-updated by API. DO NOT EDIT MANUALLY.
-- ==============================================================================

local Players = game:GetService("Players")
local player = Players.LocalPlayer
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")

-- ========================== VALID KEYS (AUTO-UPDATED) ==========================
-- ⚠️ This list is updated automatically by the API
-- Last updated: {{LAST_UPDATED}}
local VALID_KEYS = {{WHITELIST_KEYS}}

-- ========================== KEY VALIDATION ==========================
local function isValidKey(key)
    if not key or key == "" then
        return false, "Key is empty!"
    end
    if VALID_KEYS[key] then
        return true, VALID_KEYS[key]
    end
    return false, "Invalid key! Get one at work.ink/28wp/Greedy-hudzell"
end

-- ========================== UI FOR KEY INPUT ==========================
local keyGui = Instance.new("ScreenGui")
keyGui.Name = "KeySystem"
keyGui.Parent = player:WaitForChild("PlayerGui")
keyGui.ResetOnSpawn = false

local keyFrame = Instance.new("Frame")
keyFrame.Size = UDim2.new(0, 420, 0, 250)
keyFrame.Position = UDim2.new(0.5, -210, 0.5, -125)
keyFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
keyFrame.BorderSizePixel = 0
keyFrame.Parent = keyGui
Instance.new("UICorner", keyFrame).CornerRadius = UDim.new(0, 14)
keyFrame.Active = true
keyFrame.Draggable = true

local titleLabel = Instance.new("TextLabel")
titleLabel.Size = UDim2.new(1, 0, 0.25, 0)
titleLabel.Position = UDim2.new(0, 0, 0, 15)
titleLabel.BackgroundTransparency = 1
titleLabel.TextColor3 = Color3.fromRGB(0, 255, 180)
titleLabel.Text = "🔐 Greedy Hudzell"
titleLabel.TextSize = 28
titleLabel.Font = Enum.Font.GothamBold
titleLabel.Parent = keyFrame

local subLabel = Instance.new("TextLabel")
subLabel.Size = UDim2.new(1, 0, 0.15, 0)
subLabel.Position = UDim2.new(0, 0, 0, 70)
subLabel.BackgroundTransparency = 1
subLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
subLabel.Text = "Enter your license key to continue"
subLabel.TextSize = 16
subLabel.Font = Enum.Font.GothamSemibold
subLabel.Parent = keyFrame

local keyInput = Instance.new("TextBox")
keyInput.Size = UDim2.new(0.8, 0, 0.15, 0)
keyInput.Position = UDim2.new(0.1, 0, 0.45, 0)
keyInput.BackgroundColor3 = Color3.fromRGB(50, 50, 60)
keyInput.TextColor3 = Color3.fromRGB(255, 255, 255)
keyInput.PlaceholderText = "Enter key..."
keyInput.Font = Enum.Font.Gotham
keyInput.TextSize = 18
keyInput.ClearTextOnFocus = false
keyInput.Parent = keyFrame
Instance.new("UICorner", keyInput).CornerRadius = UDim.new(0, 8)

local statusLabel = Instance.new("TextLabel")
statusLabel.Size = UDim2.new(0.8, 0, 0.12, 0)
statusLabel.Position = UDim2.new(0.1, 0, 0.65, 0)
statusLabel.BackgroundTransparency = 1
statusLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
statusLabel.Text = ""
statusLabel.TextSize = 14
statusLabel.Font = Enum.Font.Gotham
statusLabel.Parent = keyFrame

local submitBtn = Instance.new("TextButton")
submitBtn.Size = UDim2.new(0.4, 0, 0.18, 0)
submitBtn.Position = UDim2.new(0.3, 0, 0.8, 0)
submitBtn.BackgroundColor3 = Color3.fromRGB(0, 170, 255)
submitBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
submitBtn.Text = "Activate"
submitBtn.Font = Enum.Font.GothamBold
submitBtn.TextSize = 20
submitBtn.BorderSizePixel = 0
submitBtn.Parent = keyFrame
Instance.new("UICorner", submitBtn).CornerRadius = UDim.new(0, 8)

-- ========================== KEY CHECK FUNCTION ==========================
local function checkKey()
    local key = keyInput.Text
    local valid, data = isValidKey(key)
    
    if valid then
        statusLabel.Text = "✅ Key Valid! Loading..."
        statusLabel.TextColor3 = Color3.fromRGB(0, 255, 100)
        submitBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
        submitBtn.Text = "✅ Valid"
        
        -- Store key info for main script
        _G.LicenseKey = key
        _G.LicenseData = data
        
        task.wait(0.5)
        keyGui:Destroy()
        
        -- Load the main script (Part 2)
        print("Key validated! Loading Greedy Hudzell...")
        loadstring(game:HttpGet("https://script.greedyhudzell.xyz/scripts/raw-script.lua"))()
        
    else
        statusLabel.Text = "❌ " .. data
        statusLabel.TextColor3 = Color3.fromRGB(255, 50, 50)
        submitBtn.BackgroundColor3 = Color3.fromRGB(200, 0, 0)
        submitBtn.Text = "❌ Invalid"
        keyInput.Text = ""
        
        task.wait(1.5)
        statusLabel.Text = ""
        submitBtn.BackgroundColor3 = Color3.fromRGB(0, 170, 255)
        submitBtn.Text = "Activate"
        keyInput:CaptureFocus()
    end
end
