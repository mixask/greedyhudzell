-- Greedy Hudzell v2.4.1
-- Universal + Parkour Legacy Script

print("🔥 Greedy Hudzell loaded!")

local player = game.Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()

-- Fly
local flying = false
game:GetService("UserInputService").InputBegan:Connect(function(input)
    if input.KeyCode == Enum.KeyCode.F then
        flying = not flying
        print("Fly: " .. tostring(flying))
    end
end)

print("✅ Все функции загружены. Наслаждайся!")